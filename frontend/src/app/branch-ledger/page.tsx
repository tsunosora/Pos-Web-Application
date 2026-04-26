"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, RefreshCw, ArrowUpRight, ArrowDownLeft, Scale, ChevronDown, ChevronUp, X, Wallet, Package } from 'lucide-react';
import {
    listBranchLedger, getBranchLedgerSummary, getBranchLedgerDetail,
    getLedgerBankAccounts, settleBranchLedgerCash,
    getFromBranchStock, settleBranchLedgerStock,
    LedgerEntry, LedgerDetail, LedgerRole, LedgerStatus, LedgerSummary,
    LedgerBankAccountsResponse, FromBranchStockResponse, FromBranchStockItem,
} from '@/lib/api/branch-ledger';

const STATUS_LABEL: Record<LedgerStatus, string> = {
    PENDING: 'Belum Dibayar',
    PARTIAL: 'Sebagian',
    SETTLED: 'Lunas',
    CANCELLED: 'Batal',
};

const STATUS_CHIP: Record<LedgerStatus, string> = {
    PENDING: 'bg-red-100 text-red-700 border-red-300',
    PARTIAL: 'bg-amber-100 text-amber-700 border-amber-300',
    SETTLED: 'bg-green-100 text-green-700 border-green-300',
    CANCELLED: 'bg-gray-100 text-gray-600 border-gray-300',
};

function rupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function fmtDate(s: string | null | undefined) {
    if (!s) return '—';
    return new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ROLE_TABS: { key: LedgerRole; label: string; hint: string }[] = [
    { key: 'outgoing', label: 'Saya Berhutang', hint: 'Titipan cetak yang saya kirim ke cabang lain' },
    { key: 'incoming', label: 'Piutang Saya', hint: 'Titipan cetak dari cabang lain yang saya kerjakan' },
    { key: 'all', label: 'Semua', hint: 'Semua entri yang melibatkan cabang ini' },
];

const STATUS_TABS: (LedgerStatus | 'ALL')[] = ['ALL', 'PENDING', 'PARTIAL', 'SETTLED', 'CANCELLED'];

export default function BranchLedgerPage() {
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [summary, setSummary] = useState<LedgerSummary | null>(null);
    const [role, setRole] = useState<LedgerRole>('outgoing');
    const [status, setStatus] = useState<LedgerStatus | 'ALL'>('ALL');
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState<number | null>(null);
    const [details, setDetails] = useState<Record<number, LedgerDetail>>({});
    const [settleTarget, setSettleTarget] = useState<LedgerEntry | null>(null);
    const [stockTarget, setStockTarget] = useState<LedgerEntry | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [list, sum] = await Promise.all([
                listBranchLedger(role, status),
                getBranchLedgerSummary(),
            ]);
            setEntries(list);
            setSummary(sum);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [role, status]);

    useEffect(() => { load(); }, [load]);

    const toggleExpand = async (id: number) => {
        if (expanded === id) { setExpanded(null); return; }
        setExpanded(id);
        if (!details[id]) {
            try {
                const d = await getBranchLedgerDetail(id);
                setDetails(prev => ({ ...prev, [id]: d }));
            } catch (e) { console.error(e); }
        }
    };

    const total = useMemo(() => entries.reduce((a, e) => a + e.outstandingAmount, 0), [entries]);

    return (
        <div>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <BookOpen className="w-6 h-6" /> Buku Titipan Antar Cabang
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Catatan hutang-piutang otomatis saat cabang saling titip cetak. Dicatat waktu cetakan diserahkan.
                    </p>
                </div>
                <button onClick={load} disabled={loading} className="text-sm bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {summary && summary.mode === 'single' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                    <div className="bg-white border rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                            <ArrowUpRight className="w-3.5 h-3.5 text-red-500" /> Hutang Keluar
                        </div>
                        <p className="text-2xl font-bold text-red-700">{rupiah(summary.outgoing.outstanding)}</p>
                        <p className="text-xs text-gray-500 mt-1">{summary.outgoing.count} titipan keluar</p>
                    </div>
                    <div className="bg-white border rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                            <ArrowDownLeft className="w-3.5 h-3.5 text-green-600" /> Piutang Masuk
                        </div>
                        <p className="text-2xl font-bold text-green-700">{rupiah(summary.incoming.outstanding)}</p>
                        <p className="text-xs text-gray-500 mt-1">{summary.incoming.count} titipan masuk</p>
                    </div>
                    <div className={`bg-white border rounded-xl p-4 shadow-sm ${summary.netPosition >= 0 ? 'border-green-200' : 'border-red-200'}`}>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                            <Scale className="w-3.5 h-3.5" /> Posisi Netto
                        </div>
                        <p className={`text-2xl font-bold ${summary.netPosition >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {summary.netPosition >= 0 ? '+' : ''}{rupiah(summary.netPosition)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {summary.netPosition >= 0 ? 'Cabang lain lebih banyak hutang ke Anda' : 'Anda lebih banyak hutang ke cabang lain'}
                        </p>
                    </div>
                </div>
            )}

            {summary && summary.mode === 'all' && summary.pairs.length > 0 && (
                <div className="bg-white border rounded-xl p-4 mb-5 shadow-sm">
                    <p className="text-sm font-semibold mb-3">Saldo per Pasangan Cabang</p>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                                <tr>
                                    <th className="px-3 py-2 text-left">Pemesan (Berhutang)</th>
                                    <th className="px-3 py-2 text-left">Pelaksana (Piutang)</th>
                                    <th className="px-3 py-2 text-right">Jumlah Titipan</th>
                                    <th className="px-3 py-2 text-right">Outstanding</th>
                                    <th className="px-3 py-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.pairs.map(p => (
                                    <tr key={`${p.fromBranchId}-${p.toBranchId}`} className="border-t">
                                        <td className="px-3 py-2">{p.fromBranchCode || p.fromBranchName}</td>
                                        <td className="px-3 py-2">{p.toBranchCode || p.toBranchName}</td>
                                        <td className="px-3 py-2 text-right">{p.totalCount}</td>
                                        <td className="px-3 py-2 text-right font-semibold text-red-700">{rupiah(p.outstanding)}</td>
                                        <td className="px-3 py-2 text-right text-gray-600">{rupiah(p.grossTotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="flex gap-1">
                    {ROLE_TABS.map(t => (
                        <button key={t.key} onClick={() => setRole(t.key)}
                            title={t.hint}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${role === t.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-1 ml-auto">
                    {STATUS_TABS.map(s => (
                        <button key={s} onClick={() => setStatus(s)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${status === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                            {s === 'ALL' ? 'Semua Status' : STATUS_LABEL[s]}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white border rounded-xl overflow-hidden">
                {entries.length === 0 ? (
                    <div className="p-10 text-center text-gray-500 text-sm">
                        Belum ada entri ledger untuk filter ini.
                    </div>
                ) : (
                    <div className="divide-y">
                        {entries.map(e => (
                            <div key={e.id} className="p-4 hover:bg-gray-50">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-xs text-indigo-700 font-bold">{e.invoiceNumber}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STATUS_CHIP[e.status]}`}>
                                                {STATUS_LABEL[e.status]}
                                            </span>
                                            <span className="text-xs text-gray-600">
                                                {e.fromBranchCode || e.fromBranchName}
                                                <span className="text-gray-400 mx-1">→</span>
                                                {e.toBranchCode || e.toBranchName}
                                            </span>
                                        </div>
                                        <p className="text-sm mt-1 font-medium">{e.customerName || 'Tanpa nama'}</p>
                                        <p className="text-xs text-gray-500">Tanggal: {fmtDate(e.createdAt)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500">Outstanding</p>
                                        <p className="text-lg font-bold text-red-700">{rupiah(e.outstandingAmount)}</p>
                                        <p className="text-[11px] text-gray-500">dari {rupiah(e.totalAmount)}</p>
                                    </div>
                                    <button
                                        onClick={() => toggleExpand(e.id)}
                                        className="text-xs bg-white border px-2 py-1 rounded-lg hover:bg-gray-100 self-start flex items-center gap-1"
                                    >
                                        {expanded === e.id ? <><ChevronUp className="w-3 h-3" /> Tutup</> : <><ChevronDown className="w-3 h-3" /> Detail</>}
                                    </button>
                                </div>

                                {expanded === e.id && (
                                    <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs space-y-3">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <div><p className="text-gray-500">HPP Bahan</p><p className="font-semibold">{rupiah(e.costAmount)}</p></div>
                                            <div><p className="text-gray-500">Fee Layanan</p><p className="font-semibold">{rupiah(e.serviceFee)}</p></div>
                                            <div><p className="text-gray-500">Total</p><p className="font-semibold">{rupiah(e.totalAmount)}</p></div>
                                            <div><p className="text-gray-500">Sudah Dibayar</p><p className="font-semibold text-green-700">{rupiah(e.settledAmount)}</p></div>
                                        </div>

                                        {details[e.id] && (
                                            <>
                                                <div>
                                                    <p className="font-semibold mb-1">Item Titipan</p>
                                                    <table className="w-full text-xs">
                                                        <thead className="text-gray-500">
                                                            <tr>
                                                                <th className="text-left py-1">Produk</th>
                                                                <th className="text-right">Qty</th>
                                                                <th className="text-right">HPP/Unit</th>
                                                                <th className="text-right">Subtotal</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {details[e.id].items.map(it => (
                                                                <tr key={it.id} className="border-t border-gray-200">
                                                                    <td className="py-1">
                                                                        {it.productName}
                                                                        {it.variantName && <span className="text-gray-500"> — {it.variantName}</span>}
                                                                    </td>
                                                                    <td className="text-right">{it.quantity}</td>
                                                                    <td className="text-right">{rupiah(it.effectiveHpp)}</td>
                                                                    <td className="text-right font-semibold">{rupiah(it.effectiveHpp * it.quantity)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {details[e.id].settlements.length > 0 && (
                                                    <div>
                                                        <p className="font-semibold mb-1">Riwayat Pembayaran</p>
                                                        <ul className="space-y-1">
                                                            {details[e.id].settlements.map(s => (
                                                                <li key={s.id} className="flex justify-between border-t border-gray-200 py-1">
                                                                    <span>{s.settlementType === 'CASH' ? '💰 Tunai' : '📦 Kirim Bahan'} · {fmtDate(s.createdAt)}</span>
                                                                    <span className="font-semibold">{rupiah(s.amount)}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {(e.status === 'PENDING' || e.status === 'PARTIAL') && (
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => setStockTarget(e)}
                                                    className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 flex items-center gap-1 font-semibold"
                                                >
                                                    <Package className="w-3.5 h-3.5" /> Bayar Kirim Bahan
                                                </button>
                                                <button
                                                    onClick={() => setSettleTarget(e)}
                                                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 flex items-center gap-1 font-semibold"
                                                >
                                                    <Wallet className="w-3.5 h-3.5" /> Bayar Tunai
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {entries.length > 0 && (
                    <div className="bg-gray-50 border-t px-4 py-2 text-xs flex justify-between">
                        <span className="text-gray-600">{entries.length} entri</span>
                        <span className="font-semibold">Total Outstanding: <span className="text-red-700">{rupiah(total)}</span></span>
                    </div>
                )}
            </div>

            {settleTarget && (
                <SettleCashModal
                    ledger={settleTarget}
                    onClose={() => setSettleTarget(null)}
                    onSuccess={() => {
                        setSettleTarget(null);
                        setDetails(prev => { const { [settleTarget.id]: _, ...rest } = prev; return rest; });
                        load();
                    }}
                />
            )}

            {stockTarget && (
                <SettleStockModal
                    ledger={stockTarget}
                    onClose={() => setStockTarget(null)}
                    onSuccess={() => {
                        setStockTarget(null);
                        setDetails(prev => { const { [stockTarget.id]: _, ...rest } = prev; return rest; });
                        load();
                    }}
                />
            )}
        </div>
    );
}

interface SettleCashModalProps {
    ledger: LedgerEntry;
    onClose: () => void;
    onSuccess: () => void;
}

function SettleCashModal({ ledger, onClose, onSuccess }: SettleCashModalProps) {
    const [banks, setBanks] = useState<LedgerBankAccountsResponse | null>(null);
    const [amount, setAmount] = useState<string>(String(ledger.outstandingAmount));
    const [bankA, setBankA] = useState<number | ''>('');
    const [bankB, setBankB] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const b = await getLedgerBankAccounts(ledger.id);
                setBanks(b);
            } catch (e: any) {
                setError(e?.response?.data?.message || e?.message || 'Gagal memuat rekening');
            } finally { setLoading(false); }
        })();
    }, [ledger.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const num = Number(amount);
        if (!num || num <= 0) { setError('Nominal harus lebih dari 0'); return; }
        if (num > ledger.outstandingAmount + 0.01) {
            setError(`Nominal melebihi sisa hutang ${rupiah(ledger.outstandingAmount)}`);
            return;
        }
        setSubmitting(true);
        try {
            await settleBranchLedgerCash(ledger.id, {
                amount: num,
                bankAccountAId: bankA || null,
                bankAccountBId: bankB || null,
                notes: notes || null,
            });
            onSuccess();
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || 'Gagal menyimpan pembayaran');
        } finally { setSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
                    <h2 className="font-bold text-lg flex items-center gap-2"><Wallet className="w-5 h-5" /> Bayar Tunai</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="bg-gray-50 border rounded-lg p-3 text-sm">
                        <p className="font-mono text-xs text-indigo-700 font-bold">{ledger.invoiceNumber}</p>
                        <p className="text-xs text-gray-600 mt-1">
                            <span className="font-semibold">{ledger.fromBranchCode || ledger.fromBranchName}</span>
                            <span className="mx-1 text-gray-400">bayar ke</span>
                            <span className="font-semibold">{ledger.toBranchCode || ledger.toBranchName}</span>
                        </p>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                            <div><p className="text-gray-500">Total</p><p className="font-semibold">{rupiah(ledger.totalAmount)}</p></div>
                            <div><p className="text-gray-500">Sudah Dibayar</p><p className="font-semibold text-green-700">{rupiah(ledger.settledAmount)}</p></div>
                            <div><p className="text-gray-500">Sisa</p><p className="font-semibold text-red-700">{rupiah(ledger.outstandingAmount)}</p></div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-1">Nominal Bayar</label>
                        <input
                            type="number"
                            inputMode="numeric"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            required
                        />
                        <div className="flex gap-1 mt-1">
                            <button type="button" onClick={() => setAmount(String(ledger.outstandingAmount))}
                                className="text-xs text-indigo-600 hover:underline">Bayar lunas</button>
                            <span className="text-gray-300">·</span>
                            <button type="button" onClick={() => setAmount(String(Math.round(ledger.outstandingAmount / 2)))}
                                className="text-xs text-indigo-600 hover:underline">Separuh</button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-sm text-gray-500">Memuat rekening...</div>
                    ) : banks && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold mb-1">
                                    Dari Rekening ({ledger.fromBranchCode || ledger.fromBranchName})
                                </label>
                                <select
                                    value={bankA}
                                    onChange={e => setBankA(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full border rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="">— Tunai/Cash —</option>
                                    {banks.fromAccounts.map(b => (
                                        <option key={b.id} value={b.id}>{b.bankName} · {b.accountNumber}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1">
                                    Ke Rekening ({ledger.toBranchCode || ledger.toBranchName})
                                </label>
                                <select
                                    value={bankB}
                                    onChange={e => setBankB(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full border rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="">— Tunai/Cash —</option>
                                    {banks.toAccounts.map(b => (
                                        <option key={b.id} value={b.id}>{b.bankName} · {b.accountNumber}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold mb-1">Catatan (opsional)</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            placeholder="mis. bayar via transfer 24 April"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2">{error}</div>
                    )}

                    <div className="flex gap-2 justify-end pt-2 border-t">
                        <button type="button" onClick={onClose} disabled={submitting}
                            className="px-4 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50">
                            Batal
                        </button>
                        <button type="submit" disabled={submitting || loading}
                            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold">
                            {submitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface SettleStockModalProps {
    ledger: LedgerEntry;
    onClose: () => void;
    onSuccess: () => void;
}

function SettleStockModal({ ledger, onClose, onSuccess }: SettleStockModalProps) {
    const [data, setData] = useState<FromBranchStockResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [variantId, setVariantId] = useState<number | null>(null);
    const [qty, setQty] = useState<string>('1');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const d = await getFromBranchStock(ledger.id);
                setData(d);
            } catch (e: any) {
                setError(e?.response?.data?.message || e?.message || 'Gagal memuat stok');
            } finally { setLoading(false); }
        })();
    }, [ledger.id]);

    const filtered = useMemo<FromBranchStockItem[]>(() => {
        if (!data) return [];
        const q = search.trim().toLowerCase();
        if (!q) return data.items;
        return data.items.filter(it =>
            it.sku.toLowerCase().includes(q) ||
            it.productName.toLowerCase().includes(q) ||
            (it.variantName || '').toLowerCase().includes(q),
        );
    }, [data, search]);

    const selected = data?.items.find(it => it.variantId === variantId) ?? null;
    const qtyNum = Number(qty) || 0;
    const value = selected ? Math.round(selected.hpp * qtyNum * 100) / 100 : 0;
    const exceedsOutstanding = value > ledger.outstandingAmount + 0.01;
    const exceedsStock = selected ? qtyNum > selected.stock : false;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!selected) { setError('Pilih bahan dulu'); return; }
        if (!qtyNum || qtyNum <= 0) { setError('Jumlah harus > 0'); return; }
        if (exceedsStock) { setError(`Stok hanya ${selected.stock}`); return; }
        if (exceedsOutstanding) { setError('Nilai melebihi sisa hutang. Kurangi quantity.'); return; }
        setSubmitting(true);
        try {
            await settleBranchLedgerStock(ledger.id, {
                productVariantId: selected.variantId,
                quantity: qtyNum,
                notes: notes || null,
            });
            onSuccess();
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || 'Gagal menyimpan');
        } finally { setSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
                    <h2 className="font-bold text-lg flex items-center gap-2"><Package className="w-5 h-5" /> Bayar dengan Kirim Bahan</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="bg-gray-50 border rounded-lg p-3 text-sm">
                        <p className="font-mono text-xs text-indigo-700 font-bold">{ledger.invoiceNumber}</p>
                        <p className="text-xs text-gray-600 mt-1">
                            Stok diambil dari <span className="font-semibold">{ledger.fromBranchCode || ledger.fromBranchName}</span>
                            <span className="mx-1">→</span>
                            masuk ke <span className="font-semibold">{ledger.toBranchCode || ledger.toBranchName}</span>
                        </p>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                            <div><p className="text-gray-500">Total</p><p className="font-semibold">{rupiah(ledger.totalAmount)}</p></div>
                            <div><p className="text-gray-500">Sudah Dibayar</p><p className="font-semibold text-green-700">{rupiah(ledger.settledAmount)}</p></div>
                            <div><p className="text-gray-500">Sisa</p><p className="font-semibold text-red-700">{rupiah(ledger.outstandingAmount)}</p></div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-1">Pilih Bahan</label>
                        <input
                            type="search" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Cari SKU / nama produk..."
                            className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
                        />
                        {loading ? (
                            <div className="text-sm text-gray-500 p-4 text-center">Memuat stok cabang...</div>
                        ) : filtered.length === 0 ? (
                            <div className="text-sm text-gray-500 p-4 text-center border rounded-lg bg-gray-50">
                                {data?.items.length === 0
                                    ? 'Cabang pemesan belum punya stok dengan HPP > 0. Gunakan Bayar Tunai.'
                                    : 'Tidak ada yang cocok dengan pencarian.'}
                            </div>
                        ) : (
                            <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
                                {filtered.map(it => (
                                    <label key={it.variantId}
                                        className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-50 ${variantId === it.variantId ? 'bg-indigo-50' : ''}`}>
                                        <input type="radio" checked={variantId === it.variantId}
                                            onChange={() => { setVariantId(it.variantId); setQty('1'); }} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{it.productName}
                                                {it.variantName && <span className="text-gray-500"> — {it.variantName}</span>}
                                            </p>
                                            <p className="text-xs text-gray-500 font-mono">{it.sku}</p>
                                        </div>
                                        <div className="text-right text-xs">
                                            <p>Stok: <span className="font-semibold">{it.stock}</span></p>
                                            <p className="text-gray-500">HPP: {rupiah(it.hpp)}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {selected && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold mb-1">Jumlah (max {selected.stock})</label>
                                <input
                                    type="number" min={1} max={selected.stock}
                                    value={qty} onChange={e => setQty(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                                <p className="text-xs text-emerald-700">Nilai Pembayaran</p>
                                <p className="text-lg font-bold text-emerald-800">{rupiah(value)}</p>
                                <p className="text-[11px] text-emerald-600 mt-0.5">{selected.hpp.toLocaleString()} × {qtyNum}</p>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold mb-1">Catatan (opsional)</label>
                        <textarea
                            value={notes} onChange={e => setNotes(e.target.value)}
                            rows={2} className="w-full border rounded-lg px-3 py-2 text-sm"
                            placeholder="mis. dikirim via kurir internal 24 April"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2">{error}</div>
                    )}

                    <div className="flex gap-2 justify-end pt-2 border-t">
                        <button type="button" onClick={onClose} disabled={submitting}
                            className="px-4 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50">
                            Batal
                        </button>
                        <button type="submit"
                            disabled={submitting || loading || !selected || exceedsStock || exceedsOutstanding}
                            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-semibold">
                            {submitting ? 'Menyimpan...' : 'Kirim Bahan & Lunasi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
