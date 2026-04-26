"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    listPrintJobs, getPrintQueueStats, verifyPrintPin,
    startPrintJob, finishPrintJob, pickupPrintJob,
    PrintJob, PrintJobStatus,
} from '@/lib/api/print-queue';

const PIN_KEY = 'cetak_pin_session';
const PIN_TTL = 24 * 60 * 60 * 1000;
const OP_KEY = 'cetak_operator_name';

function hasSession(): boolean {
    try {
        const raw = localStorage.getItem(PIN_KEY);
        if (!raw) return false;
        return Date.now() < JSON.parse(raw).expires;
    } catch { return false; }
}

type Tab = 'ANTRIAN' | 'PROSES' | 'SELESAI' | 'DIAMBIL';
const TABS: { key: Tab; label: string }[] = [
    { key: 'ANTRIAN', label: 'Antrian' },
    { key: 'PROSES', label: 'Proses' },
    { key: 'SELESAI', label: 'Siap Diambil' },
    { key: 'DIAMBIL', label: 'Diambil' },
];

function formatDate(s: string | null) {
    if (!s) return '—';
    return new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ s }: { s: 'PENDING' | 'PARTIAL' | 'PAID' | 'FAILED' }) {
    const map: Record<string, string> = {
        PAID: 'bg-green-100 text-green-800 border-green-300',
        PARTIAL: 'bg-amber-100 text-amber-800 border-amber-300',
        PENDING: 'bg-red-100 text-red-800 border-red-300',
        FAILED: 'bg-gray-100 text-gray-600 border-gray-300',
    };
    const label = s === 'PAID' ? 'LUNAS' : s === 'PARTIAL' ? 'DP' : s === 'PENDING' ? 'BELUM LUNAS' : s;
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${map[s]}`}>{label}</span>;
}

export default function CetakPage() {
    const [authed, setAuthed] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [pinLoading, setPinLoading] = useState(false);

    const [operatorName, setOperatorName] = useState('');
    const [tab, setTab] = useState<Tab>('ANTRIAN');
    const [jobs, setJobs] = useState<PrintJob[]>([]);
    const [stats, setStats] = useState({ antrian: 0, proses: 0, selesai: 0, diambil: 0 });
    const [search, setSearch] = useState('');
    const [busyId, setBusyId] = useState<number | null>(null);
    const refreshRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (hasSession()) setAuthed(true);
        const storedOp = localStorage.getItem(OP_KEY);
        if (storedOp) setOperatorName(storedOp);
    }, []);

    const loadData = useCallback(async () => {
        try {
            const [j, s] = await Promise.all([listPrintJobs(), getPrintQueueStats()]);
            setJobs(j);
            setStats(s);
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        if (!authed) return;
        loadData();
        refreshRef.current = setInterval(loadData, 30000);
        return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
    }, [authed, loadData]);

    const handlePin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pinInput) return;
        setPinLoading(true); setPinError('');
        try {
            const res = await verifyPrintPin(pinInput);
            if (res.valid) {
                localStorage.setItem(PIN_KEY, JSON.stringify({ expires: Date.now() + PIN_TTL }));
                setAuthed(true);
            } else {
                setPinError(res.message || 'PIN salah.');
                setPinInput('');
            }
        } catch { setPinError('Gagal menghubungi server.'); }
        finally { setPinLoading(false); }
    };

    const ensureOperator = (): string | null => {
        let name = operatorName.trim();
        if (!name) {
            const input = window.prompt('Nama operator cetak:');
            if (!input?.trim()) return null;
            name = input.trim();
            setOperatorName(name);
            localStorage.setItem(OP_KEY, name);
        }
        return name;
    };

    const handleStart = async (job: PrintJob) => {
        const name = ensureOperator();
        if (!name) return;
        setBusyId(job.id);
        try { await startPrintJob(job.id, name); await loadData(); }
        finally { setBusyId(null); }
    };
    const handleFinish = async (job: PrintJob) => {
        const name = ensureOperator();
        if (!name) return;
        setBusyId(job.id);
        try { await finishPrintJob(job.id, name); await loadData(); }
        finally { setBusyId(null); }
    };
    const handlePickup = async (job: PrintJob) => {
        if (!window.confirm(`Konfirmasi cetakan ${job.jobNumber} sudah diambil?`)) return;
        setBusyId(job.id);
        try { await pickupPrintJob(job.id); await loadData(); }
        finally { setBusyId(null); }
    };

    const filtered = jobs.filter(j => {
        if (j.status !== tab) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            j.jobNumber.toLowerCase().includes(q) ||
            (j.transaction.invoiceNumber || '').toLowerCase().includes(q) ||
            (j.transaction.checkoutNumber || '').toLowerCase().includes(q) ||
            (j.transaction.customerName || '').toLowerCase().includes(q)
        );
    });

    if (!authed) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-sky-50 p-4">
                <form onSubmit={handlePin} className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm">
                    <h1 className="text-2xl font-bold mb-1">Antrian Cetak Paper</h1>
                    <p className="text-sm text-gray-500 mb-5">Masukkan PIN operator</p>
                    <input
                        type="password"
                        inputMode="numeric"
                        value={pinInput}
                        onChange={e => setPinInput(e.target.value)}
                        className="w-full border rounded-lg px-4 py-3 text-lg tracking-widest text-center focus:ring-2 focus:ring-indigo-400 outline-none"
                        placeholder="••••"
                        autoFocus
                    />
                    {pinError && <p className="text-red-600 text-sm mt-2">{pinError}</p>}
                    <button
                        type="submit"
                        disabled={pinLoading}
                        className="w-full mt-4 bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >{pinLoading ? 'Memeriksa...' : 'Masuk'}</button>
                </form>
                <div className="mt-6 text-center">
                    <p className="text-sm font-semibold text-gray-400 tracking-wide">Voliko Print</p>
                    <p className="text-xs text-gray-400 mt-0.5">&copy; 2026 Muhammad Faisal Abdul Hakim</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <h1 className="text-2xl font-bold">Antrian Cetak Paper</h1>
                        <p className="text-sm text-gray-600">
                            Operator: <span className="font-semibold">{operatorName || '—'}</span>
                            {operatorName && (
                                <button
                                    onClick={() => { setOperatorName(''); localStorage.removeItem(OP_KEY); }}
                                    className="ml-2 text-xs text-indigo-600 underline"
                                >ganti</button>
                            )}
                        </p>
                    </div>
                    <input
                        type="search"
                        placeholder="Cari no. job / invoice / pelanggan..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm w-72 bg-white"
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto mb-4 pb-1">
                    {TABS.map(t => {
                        const count = (stats as any)[t.key.toLowerCase()] ?? 0;
                        const active = tab === t.key;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                            >{t.label} <span className={`ml-1 px-1.5 rounded ${active ? 'bg-indigo-500' : 'bg-gray-100'}`}>{count}</span></button>
                        );
                    })}
                </div>

                {filtered.length === 0 ? (
                    <div className="bg-white border border-dashed rounded-xl p-10 text-center text-gray-500">Tidak ada job di tab ini.</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filtered.map(job => {
                            const item = job.transactionItem;
                            const variant = item.productVariant;
                            return (
                                <div key={job.id} className="bg-white border rounded-xl p-4 shadow-sm flex flex-col">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <p className="font-mono text-xs text-indigo-700 font-bold">{job.jobNumber}</p>
                                            <p className="text-[11px] text-gray-500">{formatDate(job.createdAt)}</p>
                                            {(() => {
                                                const tx: any = job.transaction;
                                                const isTitipan = tx.productionBranchId != null && tx.productionBranchId !== tx.branchId;
                                                const ownerLabel = tx.branch?.code || tx.branch?.name;
                                                if (isTitipan) {
                                                    return (
                                                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded-full"
                                                            title={`Titipan cetak dari ${tx.branch?.name || '-'}`}>
                                                            ⚑ Titipan {ownerLabel || '?'}
                                                        </span>
                                                    );
                                                }
                                                if (ownerLabel) {
                                                    return (
                                                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-1.5 py-0.5 bg-sky-100 text-sky-700 border border-sky-300 rounded-full"
                                                            title={`Nota milik ${tx.branch?.name || '-'}`}>
                                                            🏢 {ownerLabel}
                                                        </span>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        <StatusBadge s={job.transaction.status} />
                                    </div>
                                    <div className="mb-2">
                                        <p className="font-semibold text-sm">{variant.product.name}</p>
                                        {variant.variantName && <p className="text-xs text-gray-600">{variant.variantName}</p>}
                                        <p className="text-xs text-gray-500 mt-1">Qty: <span className="font-bold text-gray-800">{job.quantity}</span>{item.clickType && ` • ${item.clickType}`}</p>
                                    </div>
                                    <div className="text-xs text-gray-700 mb-2 border-t pt-2">
                                        <p>Invoice: <span className="font-mono">{job.transaction.invoiceNumber}</span></p>
                                        {job.transaction.checkoutNumber && (
                                            <p>SC: <span className="font-mono">{job.transaction.checkoutNumber}</span></p>
                                        )}
                                        <p>Pelanggan: {job.transaction.customerName || '—'}</p>
                                    </div>
                                    {job.notes && <p className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 rounded p-1.5 mb-2">{job.notes}</p>}
                                    {(job.startedAt || job.finishedAt || job.pickedUpAt) && (
                                        <div className="text-[10px] text-gray-500 mb-2 space-y-0.5">
                                            {job.startedAt && <p>Mulai: {formatDate(job.startedAt)} oleh {job.operatorName || '—'}</p>}
                                            {job.finishedAt && <p>Selesai: {formatDate(job.finishedAt)}</p>}
                                            {job.pickedUpAt && <p>Diambil: {formatDate(job.pickedUpAt)}</p>}
                                        </div>
                                    )}

                                    <div className="mt-auto pt-2">
                                        {job.status === 'ANTRIAN' && (
                                            <button disabled={busyId === job.id} onClick={() => handleStart(job)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50">Mulai Cetak</button>
                                        )}
                                        {job.status === 'PROSES' && (
                                            <button disabled={busyId === job.id} onClick={() => handleFinish(job)} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50">Tandai Selesai</button>
                                        )}
                                        {job.status === 'SELESAI' && (
                                            <button disabled={busyId === job.id} onClick={() => handlePickup(job)} className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50">Konfirmasi Diambil</button>
                                        )}
                                        {job.status === 'DIAMBIL' && (
                                            <div className="text-center text-xs text-gray-500 py-2">✓ Selesai & Diambil</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer className="mt-8 py-4 text-center">
                <p className="text-sm font-semibold text-gray-400 tracking-wide">Voliko Print</p>
                <p className="text-xs text-gray-400 mt-0.5">&copy; 2026 Muhammad Faisal Abdul Hakim</p>
            </footer>
        </div>
    );
}
