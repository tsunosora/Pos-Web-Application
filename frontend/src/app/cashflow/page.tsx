"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus, ArrowDownRight, ArrowUpRight, ArrowRightLeft, Loader2,
    Pencil, Trash2, TrendingUp, BarChart3, Download, Filter, X, Store,
    Clock, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import {
    getCashflows, createCashflow, updateCashflow, deleteCashflow,
    getCashflowMonthlyTrend, getCashflowCategoryBreakdown, getCashflowPlatformBreakdown,
    getBankAccounts,
    submitCashflowRequest, getPendingRequests, getMyRequests, approveRequest, rejectRequest,
    type CashflowChangeRequest,
} from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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
    paymentMethod?: string | null;
    bankAccount?: { bankName: string; accountNumber: string } | null;
};

type PeriodKey = 'today' | 'yesterday' | 'this_month' | 'last_3_months' | 'this_year' | 'all' | 'custom';

const PERIODS: { key: PeriodKey; label: string }[] = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'yesterday', label: 'Kemarin' },
    { key: 'this_month', label: 'Bulan Ini' },
    { key: 'last_3_months', label: '3 Bulan' },
    { key: 'this_year', label: 'Tahun Ini' },
    { key: 'all', label: 'Semua' },
    { key: 'custom', label: 'Kustom' },
];

const INCOME_CATEGORIES = ['Penjualan Lunas', 'Pembayaran DP', 'Pelunasan DP', 'Modal Usaha', 'Investasi', 'Pinjaman', 'Lainnya'];
const EXPENSE_CATEGORIES = ['Operasional', 'Bahan Baku', 'Gaji Karyawan', 'Sewa', 'Listrik & Air', 'Transportasi', 'Marketing', 'Pemeliharaan', 'Pajak', 'Lainnya'];
const PLATFORM_OPTIONS = ['POS (Offline)', 'Tokopedia', 'Shopee', 'Lincah', 'TikTok Shop', 'Lainnya'];

function getPeriodDates(period: PeriodKey, customStart?: string, customEnd?: string): { startDate?: string; endDate?: string } {
    const now = dayjs();
    if (period === 'today') return { startDate: now.format('YYYY-MM-DD'), endDate: now.format('YYYY-MM-DD') };
    if (period === 'yesterday') { const y = now.subtract(1, 'day'); return { startDate: y.format('YYYY-MM-DD'), endDate: y.format('YYYY-MM-DD') }; }
    if (period === 'this_month') return { startDate: now.startOf('month').format('YYYY-MM-DD'), endDate: now.endOf('month').format('YYYY-MM-DD') };
    if (period === 'last_3_months') return { startDate: now.subtract(2, 'month').startOf('month').format('YYYY-MM-DD'), endDate: now.endOf('month').format('YYYY-MM-DD') };
    if (period === 'this_year') return { startDate: now.startOf('year').format('YYYY-MM-DD'), endDate: now.endOf('year').format('YYYY-MM-DD') };
    if (period === 'custom') return { startDate: customStart || undefined, endDate: customEnd || undefined };
    return {};
}

const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const fmtShort = (n: number) => {
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
    if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}k`;
    return `Rp ${n}`;
};

// --- Edit Modal ---
function EditModal({ entry, bankAccounts, onClose, onSave, isPending }: {
    entry: CashflowEntry;
    bankAccounts: { id: number; bankName: string; accountNumber: string }[];
    onClose: () => void;
    onSave: (id: number, data: any) => void;
    isPending?: boolean;
}) {
    const [category, setCategory] = useState(entry.category);
    const [amount, setAmount] = useState(parseFloat(entry.amount).toString());
    const [note, setNote] = useState(entry.note ?? '');
    const [platformSource, setPlatformSource] = useState(entry.platformSource ?? 'POS (Offline)');
    const [customPlatform, setCustomPlatform] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<string>(entry.paymentMethod ?? 'CASH');
    const [bankAccountId, setBankAccountId] = useState<number | ''>(entry.bankAccount
        ? (bankAccounts.find(b => b.bankName === entry.bankAccount?.bankName)?.id ?? '')
        : '');
    const categories = entry.type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalPlatform = entry.type === 'INCOME'
            ? (platformSource === 'Lainnya' ? (customPlatform || 'Lainnya') : platformSource)
            : null;
        onSave(entry.id, {
            category, amount: parseFloat(amount), note, platformSource: finalPlatform,
            paymentMethod,
            bankAccountId: paymentMethod === 'BANK_TRANSFER' && bankAccountId ? bankAccountId : null,
        });
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
                                <input type="text" value={customPlatform} onChange={e => setCustomPlatform(e.target.value)}
                                    placeholder="Nama platform..." className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            )}
                        </div>
                    )}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Metode Pembayaran</label>
                        <div className="flex gap-2">
                            {(['CASH', 'QRIS', 'BANK_TRANSFER'] as const).map(m => (
                                <button type="button" key={m}
                                    onClick={() => { setPaymentMethod(m); if (m !== 'BANK_TRANSFER') setBankAccountId(''); }}
                                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${paymentMethod === m ? 'bg-primary/10 text-primary border-primary/30' : 'border-input text-muted-foreground hover:bg-muted/50'}`}>
                                    {m === 'CASH' ? '💵 Tunai' : m === 'QRIS' ? '📱 QRIS' : '🏦 Transfer'}
                                </button>
                            ))}
                        </div>
                    </div>
                    {paymentMethod === 'BANK_TRANSFER' && bankAccounts.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Rekening</label>
                            <select value={bankAccountId} onChange={e => setBankAccountId(Number(e.target.value) || '')}
                                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                                <option value="">-- Pilih Rekening --</option>
                                {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bankName} — {b.accountNumber}</option>)}
                            </select>
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

// --- Submit Request Modal (for cashier) ---
function SubmitRequestModal({ entry, type, bankAccounts, onClose, onSubmit, isPending }: {
    entry: CashflowEntry;
    type: 'EDIT' | 'DELETE';
    bankAccounts: { id: number; bankName: string; accountNumber: string }[];
    onClose: () => void;
    onSubmit: (payload: Record<string, any> | undefined, note: string) => void;
    isPending?: boolean;
}) {
    const [category, setCategory] = useState(entry.category);
    const [amount, setAmount] = useState(parseFloat(entry.amount).toString());
    const [editNote, setEditNote] = useState(entry.note ?? '');
    const [platformSource, setPlatformSource] = useState(entry.platformSource ?? 'POS (Offline)');
    const [customPlatform, setCustomPlatform] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<string>(entry.paymentMethod ?? 'CASH');
    const [bankAccountId, setBankAccountId] = useState<number | ''>(
        entry.bankAccount ? (bankAccounts.find(b => b.bankName === entry.bankAccount?.bankName)?.id ?? '') : ''
    );
    const [requesterNote, setRequesterNote] = useState('');
    const categories = entry.type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (type === 'DELETE') {
            onSubmit(undefined, requesterNote);
        } else {
            const finalPlatform = entry.type === 'INCOME'
                ? (platformSource === 'Lainnya' ? (customPlatform || 'Lainnya') : platformSource)
                : null;
            onSubmit({
                category, amount: parseFloat(amount), note: editNote, platformSource: finalPlatform,
                paymentMethod,
                bankAccountId: paymentMethod === 'BANK_TRANSFER' && bankAccountId ? bankAccountId : null,
            }, requesterNote);
        }
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                    <h3 className="font-semibold text-foreground">
                        {type === 'DELETE' ? 'Kirim Permintaan Hapus' : 'Kirim Permintaan Edit'}
                    </h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
                <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        Permintaan ini akan dikirim ke manajer untuk disetujui
                    </p>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {type === 'DELETE' ? (
                        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                            <p className="text-sm font-medium text-foreground mb-1">Konfirmasi Hapus:</p>
                            <p className="text-sm text-muted-foreground">{entry.category} — {fmt(parseFloat(entry.amount))}</p>
                            <p className="text-xs text-muted-foreground mt-1">{dayjs(entry.date).format('DD MMM YYYY HH:mm')}</p>
                        </div>
                    ) : (
                        <>
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
                                        <input type="text" value={customPlatform} onChange={e => setCustomPlatform(e.target.value)} placeholder="Nama platform..." className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                    )}
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Metode Pembayaran</label>
                                <div className="flex gap-2">
                                    {(['CASH', 'QRIS', 'BANK_TRANSFER'] as const).map(m => (
                                        <button type="button" key={m}
                                            onClick={() => { setPaymentMethod(m); if (m !== 'BANK_TRANSFER') setBankAccountId(''); }}
                                            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${paymentMethod === m ? 'bg-primary/10 text-primary border-primary/30' : 'border-input text-muted-foreground hover:bg-muted/50'}`}>
                                            {m === 'CASH' ? '💵 Tunai' : m === 'QRIS' ? '📱 QRIS' : '🏦 Transfer'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {paymentMethod === 'BANK_TRANSFER' && bankAccounts.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Rekening</label>
                                    <select value={bankAccountId} onChange={e => setBankAccountId(Number(e.target.value) || '')} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                                        <option value="">-- Pilih Rekening --</option>
                                        {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bankName} — {b.accountNumber}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Nominal (Rp)</label>
                                <input required type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Catatan</label>
                                <textarea rows={2} value={editNote} onChange={e => setEditNote(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                            </div>
                        </>
                    )}
                    <div className="space-y-2 pt-2 border-t border-border">
                        <label className="text-sm font-medium text-foreground">Alasan / Catatan untuk Manajer <span className="text-muted-foreground font-normal">(opsional)</span></label>
                        <textarea rows={2} value={requesterNote} onChange={e => setRequesterNote(e.target.value)} placeholder="Contoh: Salah input nominal..." className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                    </div>
                    <div className="pt-2 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-input hover:bg-muted/50 transition-colors">Batal</button>
                        <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                            {isPending ? 'Mengirim...' : 'Kirim Permintaan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// --- Review Modal (for manager) ---
function ReviewModal({ request, note, setNote, onClose, onApprove, onReject, isApproving, isRejecting }: {
    request: CashflowChangeRequest;
    note: string;
    setNote: (v: string) => void;
    onClose: () => void;
    onApprove: () => void;
    onReject: () => void;
    isApproving?: boolean;
    isRejecting?: boolean;
}) {
    const cf = request.cashflow;
    const payload = request.payload;
    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                    <h3 className="font-semibold text-foreground">Tinjau Permintaan</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Dari:</span>
                        <span className="font-medium text-foreground">{request.requester.name || request.requester.email}</span>
                        <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${request.type === 'DELETE' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                            {request.type === 'DELETE' ? 'Hapus' : 'Edit'}
                        </span>
                    </div>

                    <div className="bg-muted/40 rounded-lg p-3 space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data Saat Ini</p>
                        <p className="text-sm font-medium">{cf.category} — {fmt(parseFloat(cf.amount))}</p>
                        <p className="text-xs text-muted-foreground">{cf.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'} • {dayjs(cf.date).format('DD MMM YYYY HH:mm')}</p>
                        {cf.note && <p className="text-xs text-muted-foreground">Catatan: {cf.note}</p>}
                    </div>

                    {request.type === 'EDIT' && payload && (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1.5">
                            <p className="text-xs font-medium text-primary uppercase tracking-wide">Perubahan yang Diusulkan</p>
                            {payload.category && payload.category !== cf.category && (
                                <p className="text-sm"><span className="text-muted-foreground">Kategori:</span> <span className="line-through text-muted-foreground">{cf.category}</span> → <span className="font-medium">{payload.category}</span></p>
                            )}
                            {payload.amount !== undefined && parseFloat(payload.amount) !== parseFloat(cf.amount) && (
                                <p className="text-sm"><span className="text-muted-foreground">Nominal:</span> <span className="line-through text-muted-foreground">{fmt(parseFloat(cf.amount))}</span> → <span className="font-medium">{fmt(parseFloat(payload.amount))}</span></p>
                            )}
                            {payload.note !== undefined && payload.note !== cf.note && (
                                <p className="text-sm"><span className="text-muted-foreground">Catatan:</span> {payload.note || '-'}</p>
                            )}
                            {payload.paymentMethod && (
                                <p className="text-sm"><span className="text-muted-foreground">Metode:</span> {payload.paymentMethod}</p>
                            )}
                        </div>
                    )}

                    {request.type === 'DELETE' && (
                        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                            <p className="text-sm text-destructive font-medium">Permintaan menghapus entry di atas secara permanen.</p>
                        </div>
                    )}

                    {request.requesterNote && (
                        <div className="text-sm">
                            <span className="text-muted-foreground">Alasan kasir: </span>
                            <span className="italic">{request.requesterNote}</span>
                        </div>
                    )}

                    <div className="space-y-2 pt-2 border-t border-border">
                        <label className="text-sm font-medium text-foreground">Catatan Manajer <span className="text-muted-foreground font-normal">(opsional untuk setujui, wajib untuk tolak)</span></label>
                        <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Catatan..." className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-input hover:bg-muted/50 transition-colors">Batal</button>
                        <button onClick={onReject} disabled={isRejecting || !note.trim()} className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50">
                            {isRejecting ? 'Menolak...' : 'Tolak'}
                        </button>
                        <button onClick={onApprove} disabled={isApproving} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                            {isApproving ? 'Menyetujui...' : 'Setujui'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CashflowPage() {
    const queryClient = useQueryClient();
    const { isManager } = useCurrentUser();

    // Period filter
    const [period, setPeriod] = useState<PeriodKey>('this_month');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const { startDate, endDate } = getPeriodDates(period, customStart, customEnd);

    const { data: bankAccounts = [] } = useQuery({
        queryKey: ['bank-accounts'],
        queryFn: getBankAccounts,
    });

    // Add entry dialog
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [type, setType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
    const [category, setCategory] = useState('');
    const [customCategory, setCustomCategory] = useState('');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [platformSource, setPlatformSource] = useState('POS (Offline)');
    const [customPlatform, setCustomPlatform] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'BANK_TRANSFER'>('CASH');
    const [bankAccountId, setBankAccountId] = useState<number | ''>('');
    const [excludeFromShift, setExcludeFromShift] = useState(false);

    // Edit + delete
    const [editEntry, setEditEntry] = useState<CashflowEntry | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    // Approval request state
    const [requestEntry, setRequestEntry] = useState<CashflowEntry | null>(null);
    const [requestType, setRequestType] = useState<'EDIT' | 'DELETE'>('EDIT');
    const [reviewingRequest, setReviewingRequest] = useState<CashflowChangeRequest | null>(null);
    const [reviewNote, setReviewNote] = useState('');
    const [requestNote, setRequestNote] = useState('');

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

    const { data: pendingRequests = [], refetch: refetchPending } = useQuery({
        queryKey: ['cashflow-requests-pending'],
        queryFn: getPendingRequests,
        enabled: isManager,
        refetchInterval: isManager ? 30_000 : false,
    });

    const { data: myRequests = [], refetch: refetchMine } = useQuery({
        queryKey: ['cashflow-requests-mine'],
        queryFn: getMyRequests,
        enabled: !isManager,
    });

    const submitRequestMutation = useMutation({
        mutationFn: submitCashflowRequest,
        onSuccess: () => { setRequestEntry(null); refetchMine(); },
    });

    const approveMutation = useMutation({
        mutationFn: ({ id, note }: { id: number; note?: string }) => approveRequest(id, note),
        onSuccess: () => { setReviewingRequest(null); setReviewNote(''); refetchPending(); invalidateAll(); },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, note }: { id: number; note: string }) => rejectRequest(id, note),
        onSuccess: () => { setReviewingRequest(null); setReviewNote(''); refetchPending(); },
    });

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
            setPaymentMethod('CASH');
            setBankAccountId('');
            setExcludeFromShift(false);
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
        createMutation.mutate({
            type, category: finalCategory, amount: parseFloat(amount), note,
            platformSource: finalPlatform,
            paymentMethod,
            bankAccountId: paymentMethod === 'BANK_TRANSFER' && bankAccountId ? bankAccountId : null,
            excludeFromShift,
        });
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
            <div className="space-y-2">
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
                {period === 'custom' && (
                    <div className="flex flex-wrap items-center gap-3 pl-6">
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-muted-foreground whitespace-nowrap">Dari</label>
                            <input
                                type="date"
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                                className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-muted-foreground whitespace-nowrap">Sampai</label>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                                min={customStart}
                                className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                    </div>
                )}
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

            {/* Manager: pending requests panel */}
            {isManager && pendingRequests.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-300 dark:border-amber-700 p-5 space-y-3">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <h3 className="font-semibold text-amber-800 dark:text-amber-300">Permintaan Persetujuan ({pendingRequests.length})</h3>
                    </div>
                    <div className="space-y-2">
                        {pendingRequests.map(req => (
                            <div key={req.id} className="flex items-center justify-between bg-white dark:bg-card rounded-lg border border-amber-200 dark:border-amber-800 px-4 py-3 gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${req.type === 'DELETE' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                                            {req.type === 'DELETE' ? 'HAPUS' : 'EDIT'}
                                        </span>
                                        <span className="text-sm font-medium text-foreground">{req.cashflow.category}</span>
                                        <span className="text-sm text-muted-foreground">{fmt(parseFloat(req.cashflow.amount))}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">Dari: {req.requester.name || req.requester.email} • {dayjs(req.createdAt).format('DD MMM HH:mm')}</p>
                                </div>
                                <button
                                    onClick={() => { setReviewingRequest(req); setReviewNote(''); }}
                                    className="shrink-0 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors">
                                    Tinjau
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cashier: my requests status */}
            {!isManager && myRequests.length > 0 && (
                <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold text-foreground">Status Permintaan Saya</h3>
                    </div>
                    <div className="space-y-2">
                        {myRequests.slice(0, 5).map(req => (
                            <div key={req.id} className="flex items-center justify-between gap-3 text-sm">
                                <div className="min-w-0">
                                    <span className="font-medium text-foreground">{req.cashflow.category}</span>
                                    <span className="text-muted-foreground ml-2">{req.type === 'DELETE' ? 'Hapus' : 'Edit'}</span>
                                    {req.reviewerNote && <p className="text-xs text-muted-foreground italic mt-0.5">Catatan: {req.reviewerNote}</p>}
                                </div>
                                <span className={`shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                                    req.status === 'PENDING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                    req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                    'bg-destructive/10 text-destructive'
                                }`}>
                                    {req.status === 'PENDING' && <Clock className="h-3 w-3" />}
                                    {req.status === 'APPROVED' && <CheckCircle2 className="h-3 w-3" />}
                                    {req.status === 'REJECTED' && <XCircle className="h-3 w-3" />}
                                    {req.status === 'PENDING' ? 'Menunggu' : req.status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                                            {entry.paymentMethod && (
                                                <span className="text-xs bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.5 rounded-full">
                                                    {entry.paymentMethod === 'CASH' ? '💵 Tunai'
                                                        : entry.paymentMethod === 'QRIS' ? '📱 QRIS'
                                                        : `🏦 ${entry.bankAccount?.bankName || 'Transfer'}`}
                                                </span>
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
                                    {/* Edit/delete: manager sees all entries, cashier only sees manual entries */}
                                    {(isManager || entry.userId) && (() => {
                                        const hasPending = !isManager && myRequests.some(
                                            r => r.cashflowId === entry.id && r.status === 'PENDING'
                                        );
                                        if (hasPending) {
                                            return (
                                                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                                                    <Clock className="h-3 w-3" /> Menunggu
                                                </span>
                                            );
                                        }
                                        return (
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => {
                                                        if (isManager) { setEditEntry(entry); }
                                                        else { setRequestEntry(entry); setRequestType('EDIT'); }
                                                    }}
                                                    className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                                    title={isManager ? 'Edit' : 'Ajukan perubahan'}>
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (isManager) { setDeleteId(entry.id); }
                                                        else { setRequestEntry(entry); setRequestType('DELETE'); }
                                                    }}
                                                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                    title={isManager ? 'Hapus' : 'Ajukan hapus'}>
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        );
                                    })()}
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
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Metode Pembayaran</label>
                                <div className="flex gap-2">
                                    {(['CASH', 'QRIS', 'BANK_TRANSFER'] as const).map(m => (
                                        <button type="button" key={m}
                                            onClick={() => { setPaymentMethod(m); if (m !== 'BANK_TRANSFER') setBankAccountId(''); }}
                                            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${paymentMethod === m ? 'bg-primary/10 text-primary border-primary/30' : 'border-input text-muted-foreground hover:bg-muted/50'}`}>
                                            {m === 'CASH' ? '💵 Tunai' : m === 'QRIS' ? '📱 QRIS' : '🏦 Transfer'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {paymentMethod === 'BANK_TRANSFER' && (bankAccounts as any[]).length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Rekening</label>
                                    <select value={bankAccountId} onChange={e => setBankAccountId(Number(e.target.value) || '')}
                                        className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                                        <option value="">-- Pilih Rekening --</option>
                                        {(bankAccounts as any[]).map((b: any) => (
                                            <option key={b.id} value={b.id}>{b.bankName} — {b.accountNumber}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
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
                            {/* Toggle: tidak masuk laporan shift */}
                            <button
                                type="button"
                                onClick={() => setExcludeFromShift(p => !p)}
                                className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl border text-left transition-all ${excludeFromShift ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' : 'border-border bg-muted/30 hover:border-primary/30'}`}
                            >
                                <div className={`w-4 h-4 rounded mt-0.5 shrink-0 flex items-center justify-center border-2 transition-colors ${excludeFromShift ? 'border-amber-500 bg-amber-500' : 'border-muted-foreground'}`}>
                                    {excludeFromShift && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </div>
                                <div>
                                    <p className={`text-sm font-medium ${excludeFromShift ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>Tidak masuk laporan shift</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Centang jika ini pengeluaran/pemasukan dari shift yang sudah lewat atau tidak relevan dengan shift aktif saat ini. Data tetap tercatat di cashflow.</p>
                                </div>
                            </button>

                            <div className="pt-2 flex justify-end gap-3">
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
                    bankAccounts={bankAccounts as any[]}
                    onClose={() => setEditEntry(null)}
                    onSave={(id, data) => updateMutation.mutate({ id, data })}
                    isPending={updateMutation.isPending}
                />
            )}

            {/* Delete confirm (manager only) */}
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

            {/* Cashier: Submit Request Modal */}
            {requestEntry && (
                <SubmitRequestModal
                    entry={requestEntry}
                    type={requestType}
                    bankAccounts={bankAccounts as any[]}
                    onClose={() => setRequestEntry(null)}
                    onSubmit={(payload, note) => submitRequestMutation.mutate({
                        cashflowId: requestEntry.id,
                        type: requestType,
                        payload: payload ?? undefined,
                        requesterNote: note || undefined,
                    })}
                    isPending={submitRequestMutation.isPending}
                />
            )}

            {/* Manager: Review Modal */}
            {reviewingRequest && (
                <ReviewModal
                    request={reviewingRequest}
                    note={reviewNote}
                    setNote={setReviewNote}
                    onClose={() => { setReviewingRequest(null); setReviewNote(''); }}
                    onApprove={() => approveMutation.mutate({ id: reviewingRequest.id, note: reviewNote || undefined })}
                    onReject={() => rejectMutation.mutate({ id: reviewingRequest.id, note: reviewNote })}
                    isApproving={approveMutation.isPending}
                    isRejecting={rejectMutation.isPending}
                />
            )}
        </div>
    );
}
