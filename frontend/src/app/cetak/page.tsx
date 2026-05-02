"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    listPrintJobs, getPrintQueueStats, verifyPrintPin,
    startPrintJob, finishPrintJob, pickupPrintJob,
    PrintJob, PrintJobStatus,
} from '@/lib/api/print-queue';
import {
    getPublicBranches, PublicBranch,
    upsertOperatorMeterReading, uploadOperatorMeterPhoto, getOperatorMeterReadings, OperatorMeterReading,
    createOperatorMachineReject, getOperatorMachineRejects, OperatorMachineReject,
    OperatorRejectType, OperatorRejectCause, OperatorCounterType,
    resolvePhotoUrl,
} from '@/lib/api/production';

// Alias lokal supaya kode di bawah tetap ringkas.
type RejectType = OperatorRejectType;
type RejectCause = OperatorRejectCause;
type CounterType = OperatorCounterType;
type MachineReject = OperatorMachineReject;
type MeterReading = OperatorMeterReading;
const createMachineReject = createOperatorMachineReject;
const getMachineRejects = getOperatorMachineRejects;
const upsertMeterReading = upsertOperatorMeterReading;
const uploadMeterPhoto = uploadOperatorMeterPhoto;
const getMeterReadings = getOperatorMeterReadings;

const PIN_KEY = 'cetak_pin_session';
const PIN_TTL = 24 * 60 * 60 * 1000;
const OP_KEY = 'cetak_operator_name';

interface CetakSession {
    expires: number;
    branchId: number | null;
    branchName: string | null;
    branchCode: string | null;
}

function readSession(): CetakSession | null {
    try {
        const raw = localStorage.getItem(PIN_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw) as CetakSession;
        if (Date.now() >= s.expires) return null;
        return s;
    } catch { return null; }
}

type Tab = 'ANTRIAN' | 'PROSES' | 'SELESAI' | 'DIAMBIL' | 'REKONSILIASI';
const TABS: { key: Tab; label: string }[] = [
    { key: 'ANTRIAN', label: 'Antrian' },
    { key: 'PROSES', label: 'Proses' },
    { key: 'SELESAI', label: 'Siap Diambil' },
    { key: 'DIAMBIL', label: 'Diambil' },
    { key: 'REKONSILIASI', label: '📊 Rekonsiliasi' },
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

    // Multi-cabang
    const [branches, setBranches] = useState<PublicBranch[]>([]);
    const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
    const [activeBranchName, setActiveBranchName] = useState<string | null>(null);
    const [activeBranchCode, setActiveBranchCode] = useState<string | null>(null);

    useEffect(() => {
        getPublicBranches().then(setBranches).catch(err => {
            console.error('[cetak] gagal memuat daftar cabang:', err);
            setBranches([]);
        });
        const session = readSession();
        if (session) {
            setActiveBranchId(session.branchId);
            setActiveBranchName(session.branchName);
            setActiveBranchCode(session.branchCode);
            setAuthed(true);
        }
        const storedOp = localStorage.getItem(OP_KEY);
        if (storedOp) setOperatorName(storedOp);
    }, []);

    const loadData = useCallback(async () => {
        try {
            const bid = activeBranchId ?? undefined;
            const [j, s] = await Promise.all([
                listPrintJobs(undefined, undefined, bid),
                getPrintQueueStats(bid),
            ]);
            setJobs(j);
            setStats(s);
        } catch (e) { console.error(e); }
    }, [activeBranchId]);

    useEffect(() => {
        if (!authed) return;
        loadData();
        refreshRef.current = setInterval(loadData, 30000);
        return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
    }, [authed, loadData]);

    const handlePin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pinInput) return;
        if (branches.length > 1 && activeBranchId == null) {
            setPinError('Pilih cabang terlebih dahulu');
            return;
        }
        setPinLoading(true); setPinError('');
        try {
            const bid = activeBranchId ?? (branches.length === 1 ? branches[0].id : null);
            const branch = branches.find(b => b.id === bid) || null;
            const res = await verifyPrintPin(pinInput, bid ?? undefined);
            if (res.valid) {
                const session: CetakSession = {
                    expires: Date.now() + PIN_TTL,
                    branchId: bid,
                    branchName: branch?.name ?? null,
                    branchCode: branch?.code ?? null,
                };
                localStorage.setItem(PIN_KEY, JSON.stringify(session));
                if (bid && branch) {
                    setActiveBranchId(bid);
                    setActiveBranchName(branch.name);
                    setActiveBranchCode(branch.code);
                }
                setAuthed(true);
            } else {
                setPinError(res.message || 'PIN salah.');
                setPinInput('');
            }
        } catch (err: any) {
            // Bedakan network error (Failed to fetch) vs HTTP error vs server error supaya
            // user/admin tahu titik masalahnya di koneksi atau di endpoint backend.
            const msg: string = err?.message || '';
            if (msg === 'Failed to fetch' || /NetworkError/i.test(msg)) {
                setPinError('Tidak bisa menghubungi server. Cek koneksi internet atau status server.');
            } else if (/HTTP 404/.test(msg)) {
                setPinError('Endpoint backend tidak ditemukan (404). Pastikan backend sudah ter-deploy versi terbaru.');
            } else if (/HTTP 5\d\d/.test(msg)) {
                setPinError(`Server error: ${msg}`);
            } else {
                setPinError(msg || 'Gagal menghubungi server.');
            }
        }
        finally { setPinLoading(false); }
    };

    const handleLogout = () => {
        localStorage.removeItem(PIN_KEY);
        setAuthed(false);
        setActiveBranchId(null);
        setActiveBranchName(null);
        setActiveBranchCode(null);
        setPinInput('');
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
        const showBranchPicker = branches.length > 1;
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-sky-50 p-4">
                <form onSubmit={handlePin} className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm">
                    <h1 className="text-2xl font-bold mb-1">Antrian Cetak Paper</h1>
                    <p className="text-sm text-gray-500 mb-5">
                        {showBranchPicker ? 'Pilih cabang & masukkan PIN operator' : 'Masukkan PIN operator'}
                    </p>

                    {showBranchPicker && (
                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Cabang</label>
                            <div className="grid grid-cols-1 gap-2">
                                {branches.map(b => (
                                    <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => setActiveBranchId(b.id)}
                                        className={`flex items-center justify-between px-4 py-2.5 rounded-lg border-2 transition-all ${
                                            activeBranchId === b.id
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-200 bg-white hover:border-indigo-300'
                                        }`}
                                    >
                                        <span className="font-semibold text-sm">{b.name}</span>
                                        {b.code && (
                                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                                                activeBranchId === b.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                                            }`}>{b.code}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">PIN Operator</label>
                    <input
                        type="password"
                        inputMode="numeric"
                        value={pinInput}
                        onChange={e => setPinInput(e.target.value)}
                        className="w-full border rounded-lg px-4 py-3 text-lg tracking-widest text-center focus:ring-2 focus:ring-indigo-400 outline-none"
                        placeholder="••••"
                        autoFocus={!showBranchPicker}
                    />
                    {pinError && <p className="text-red-600 text-sm mt-2">{pinError}</p>}
                    <button
                        type="submit"
                        disabled={pinLoading}
                        className="w-full mt-4 bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >{pinLoading ? 'Memeriksa...' : 'Masuk'}</button>

                    <p className="text-center text-xs text-gray-400 mt-4">
                        PIN per cabang. Berlaku 24 jam di perangkat ini.
                    </p>
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
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            Antrian Cetak Paper
                            {activeBranchCode && (
                                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-full">
                                    {activeBranchCode}
                                </span>
                            )}
                        </h1>
                        <p className="text-sm text-gray-600">
                            {activeBranchName && <span className="font-semibold">{activeBranchName}</span>}
                            {activeBranchName && ' · '}
                            Operator: <span className="font-semibold">{operatorName || '—'}</span>
                            {operatorName && (
                                <button
                                    onClick={() => { setOperatorName(''); localStorage.removeItem(OP_KEY); }}
                                    className="ml-2 text-xs text-indigo-600 underline"
                                >ganti</button>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="search"
                            placeholder="Cari no. job / invoice / pelanggan..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="border rounded-lg px-3 py-2 text-sm w-72 bg-white"
                        />
                        <button
                            onClick={handleLogout}
                            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100"
                        >Keluar</button>
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto mb-4 pb-1">
                    {TABS.map(t => {
                        const isRekon = t.key === 'REKONSILIASI';
                        const count = isRekon ? null : (stats as any)[t.key.toLowerCase()] ?? 0;
                        const active = tab === t.key;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                            >
                                {t.label}
                                {count != null && (
                                    <span className={`ml-1 px-1.5 rounded ${active ? 'bg-indigo-500' : 'bg-gray-100'}`}>{count}</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {tab === 'REKONSILIASI' ? (
                    activeBranchId ? <RekonsiliasiPanel branchId={activeBranchId} branchName={activeBranchName ?? ''} /> :
                    <div className="bg-white border border-dashed rounded-xl p-10 text-center text-gray-500">Cabang belum dipilih.</div>
                ) : filtered.length === 0 ? (
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

// ─── Rekonsiliasi Panel — input counter + upload foto, untuk operator di /cetak ───
function todayISO() {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDate(s: string) {
    return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface RekonsiliasiPanelProps {
    branchId: number;
    branchName: string;
}

function RekonsiliasiPanel({ branchId, branchName }: RekonsiliasiPanelProps) {
    const [form, setForm] = useState({
        readingDate: todayISO(),
        totalCount: 0,
        fullColorCount: 0,
        blackCount: 0,
        singleColorCount: 0,
        photoUrl: '',
        notes: '',
    });
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
    const [history, setHistory] = useState<MeterReading[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const loadHistory = useCallback(async () => {
        setLoadingHistory(true);
        try {
            // Last 30 days
            const end = todayISO();
            const startD = new Date();
            startD.setDate(startD.getDate() - 30);
            const start = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${String(startD.getDate()).padStart(2, '0')}`;
            const data = await getMeterReadings(branchId, start, end);
            setHistory(data);
        } catch { setHistory([]); }
        finally { setLoadingHistory(false); }
    }, [branchId]);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    const computedSum = form.fullColorCount + form.blackCount + form.singleColorCount;
    const sumMismatch = form.totalCount > 0 && computedSum !== form.totalCount;

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setToast({ kind: 'err', msg: 'File harus gambar (JPG/PNG)' });
            return;
        }
        setUploading(true);
        setToast(null);
        try {
            const url = await uploadMeterPhoto(file);
            setForm(f => ({ ...f, photoUrl: url }));
            setToast({ kind: 'ok', msg: '✓ Foto counter berhasil diupload' });
        } catch (err: any) {
            setToast({ kind: 'err', msg: err?.message || 'Gagal upload foto' });
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setToast(null);
        if (form.totalCount <= 0) { setToast({ kind: 'err', msg: 'Total counter wajib > 0' }); return; }
        if (sumMismatch) { setToast({ kind: 'err', msg: `Total (${form.totalCount}) ≠ FC + BW + SC (${computedSum})` }); return; }
        setSubmitting(true);
        try {
            await upsertMeterReading({
                branchId,
                readingDate: form.readingDate,
                totalCount: form.totalCount,
                fullColorCount: form.fullColorCount,
                blackCount: form.blackCount,
                singleColorCount: form.singleColorCount,
                photoUrl: form.photoUrl || undefined,
                notes: form.notes || undefined,
            });
            setToast({ kind: 'ok', msg: `✓ Pembacaan ${fmtDate(form.readingDate)} berhasil disimpan` });
            // Reset (kecuali tanggal — biarkan supaya kalau ada koreksi mudah re-input)
            setForm(f => ({ ...f, totalCount: 0, fullColorCount: 0, blackCount: 0, singleColorCount: 0, photoUrl: '', notes: '' }));
            loadHistory();
        } catch (err: any) {
            setToast({ kind: 'err', msg: err?.message || 'Gagal simpan pembacaan' });
        } finally { setSubmitting(false); }
    };

    return (
        <div className="space-y-4">
            {/* Form input */}
            <div className="bg-white rounded-xl border border-indigo-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div>
                        <h2 className="font-bold text-base flex items-center gap-2">📊 Input Pembacaan Counter</h2>
                        <p className="text-xs text-gray-500">Cabang: <span className="font-semibold">{branchName || `#${branchId}`}</span> · Satu pembacaan per tanggal (akan di-update kalau sudah ada)</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Tanggal & Total */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Tanggal Pembacaan</label>
                            <input type="date" value={form.readingDate} required
                                onChange={e => setForm(f => ({ ...f, readingDate: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Total Counter (Cumulative)</label>
                            <input type="number" min={0} value={form.totalCount || ''} required
                                onChange={e => setForm(f => ({ ...f, totalCount: +e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                                placeholder="contoh: 124530" />
                        </div>
                    </div>

                    {/* Breakdown FC / BW / SC */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-indigo-600 mb-1">Full Color</label>
                            <input type="number" min={0} value={form.fullColorCount || ''}
                                onChange={e => setForm(f => ({ ...f, fullColorCount: +e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Black & White</label>
                            <input type="number" min={0} value={form.blackCount || ''}
                                onChange={e => setForm(f => ({ ...f, blackCount: +e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Single Color</label>
                            <input type="number" min={0} value={form.singleColorCount || ''}
                                onChange={e => setForm(f => ({ ...f, singleColorCount: +e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
                        </div>
                    </div>

                    {/* Sum validation feedback */}
                    {form.totalCount > 0 && (
                        <div className={`text-xs px-3 py-2 rounded-lg ${sumMismatch
                            ? 'bg-red-50 border border-red-200 text-red-700'
                            : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                            {sumMismatch
                                ? `⚠ Total (${form.totalCount.toLocaleString('id-ID')}) ≠ FC+BW+SC (${computedSum.toLocaleString('id-ID')}) — selisih ${Math.abs(form.totalCount - computedSum).toLocaleString('id-ID')}`
                                : `✓ Total = FC+BW+SC (${computedSum.toLocaleString('id-ID')})`}
                        </div>
                    )}

                    {/* Upload foto */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Foto Counter Mesin</label>
                        {form.photoUrl ? (
                            <div className="flex items-start gap-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={resolvePhotoUrl(form.photoUrl) || form.photoUrl} alt="Foto counter" loading="lazy" decoding="async" className="w-32 h-32 object-cover rounded-lg border border-gray-200" />
                                <button type="button" onClick={() => setForm(f => ({ ...f, photoUrl: '' }))}
                                    className="text-xs text-red-600 hover:underline">Hapus foto</button>
                            </div>
                        ) : (
                            <label className={`flex items-center gap-2 border-2 border-dashed rounded-lg px-3 py-3 cursor-pointer hover:bg-gray-50 text-sm text-gray-500 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                                {uploading ? '⏳ Mengupload…' : '📷 Pilih / ambil foto counter'}
                                <input type="file" accept="image/*" capture="environment"
                                    onChange={handleUpload} className="hidden" />
                            </label>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Catatan (opsional)</label>
                        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="contoh: setelah ganti tinta, kondisi mesin OK" />
                    </div>

                    {/* Toast */}
                    {toast && (
                        <div className={`text-sm px-3 py-2 rounded-lg ${toast.kind === 'ok'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {toast.msg}
                        </div>
                    )}

                    {/* Submit */}
                    <button type="submit" disabled={submitting || sumMismatch || form.totalCount <= 0}
                        className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                        {submitting ? 'Menyimpan…' : '💾 Simpan Pembacaan'}
                    </button>
                </form>
            </div>

            {/* History */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h3 className="font-bold text-base">Riwayat 30 Hari Terakhir</h3>
                    <button onClick={loadHistory} disabled={loadingHistory}
                        className="text-xs px-3 py-1 bg-white border rounded-lg hover:bg-gray-50">
                        {loadingHistory ? 'Memuat…' : '↻ Refresh'}
                    </button>
                </div>
                {loadingHistory ? (
                    <p className="text-sm text-gray-500 text-center py-4">Memuat…</p>
                ) : history.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-6">Belum ada pembacaan dalam 30 hari terakhir.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-xs text-gray-500 uppercase">
                                    <th className="text-left py-2 px-2">Tanggal</th>
                                    <th className="text-right py-2 px-2">Total</th>
                                    <th className="text-right py-2 px-2 text-indigo-600">FC</th>
                                    <th className="text-right py-2 px-2">BW</th>
                                    <th className="text-right py-2 px-2 text-gray-500">SC</th>
                                    <th className="text-center py-2 px-2">Foto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map(r => (
                                    <tr key={r.id} className="border-t hover:bg-gray-50">
                                        <td className="py-2 px-2 font-medium">{fmtDate(r.readingDate)}</td>
                                        <td className="py-2 px-2 text-right font-mono font-bold">{r.totalCount.toLocaleString('id-ID')}</td>
                                        <td className="py-2 px-2 text-right font-mono text-indigo-700">{r.fullColorCount.toLocaleString('id-ID')}</td>
                                        <td className="py-2 px-2 text-right font-mono">{r.blackCount.toLocaleString('id-ID')}</td>
                                        <td className="py-2 px-2 text-right font-mono text-gray-500">{r.singleColorCount.toLocaleString('id-ID')}</td>
                                        <td className="py-2 px-2 text-center">
                                            {r.photoUrl ? (
                                                <a href={r.photoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">📷 Lihat</a>
                                            ) : <span className="text-gray-300">—</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Reject Mesin */}
            <RejectPanel branchId={branchId} branchName={branchName} />
        </div>
    );
}

// ─── Reject Mesin Panel ─────────────────────────────────────────────────────

const REJECT_TYPE_OPTIONS: { value: RejectType; label: string }[] = [
    { value: 'MACHINE_ERROR', label: 'Error Mesin' },
    { value: 'TEST_PRINT', label: 'Test Print' },
    { value: 'CALIBRATION', label: 'Kalibrasi' },
    { value: 'HUMAN_ERROR', label: 'Human Error' },
];

const COUNTER_TYPE_OPTIONS: { value: CounterType; label: string }[] = [
    { value: 'FULL_COLOR', label: 'Full Color' },
    { value: 'BLACK', label: 'Black & White' },
    { value: 'SINGLE_COLOR', label: 'Single Color' },
];

function RejectPanel({ branchId, branchName }: { branchId: number; branchName: string }) {
    const now = new Date();
    const [form, setForm] = useState({
        date: todayISO(),
        rejectType: 'MACHINE_ERROR' as RejectType,
        cause: 'MACHINE' as RejectCause,
        counterType: 'FULL_COLOR' as CounterType,
        quantity: 0,
        pricePerClick: 0,
        notes: '',
        photoUrl: '',
    });
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
    const [rejects, setRejects] = useState<MachineReject[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const loadRejects = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getMachineRejects(branchId, now.getMonth() + 1, now.getFullYear());
            setRejects(data);
        } catch { setRejects([]); }
        finally { setLoading(false); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId]);

    useEffect(() => { loadRejects(); }, [loadRejects]);

    const totalCost = (form.quantity || 0) * (form.pricePerClick || 0);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setToast({ kind: 'err', msg: 'File harus gambar' });
            return;
        }
        setUploading(true);
        setToast(null);
        try {
            const url = await uploadMeterPhoto(file);
            setForm(f => ({ ...f, photoUrl: url }));
            setToast({ kind: 'ok', msg: '✓ Foto berhasil diupload' });
        } catch (err: any) {
            setToast({ kind: 'err', msg: err?.message || 'Gagal upload foto' });
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setToast(null);
        if (form.quantity <= 0) { setToast({ kind: 'err', msg: 'Jumlah reject wajib > 0' }); return; }
        setSubmitting(true);
        try {
            await createMachineReject({
                branchId,
                rejectType: form.rejectType,
                cause: form.cause,
                counterType: form.counterType,
                quantity: form.quantity,
                pricePerClick: form.pricePerClick > 0 ? form.pricePerClick : undefined,
                notes: form.notes || undefined,
                photoUrl: form.photoUrl || undefined,
                date: form.date,
            });
            setToast({ kind: 'ok', msg: `✓ Reject berhasil dicatat` });
            setForm(f => ({ ...f, quantity: 0, pricePerClick: 0, notes: '', photoUrl: '' }));
            loadRejects();
        } catch (err: any) {
            setToast({ kind: 'err', msg: err?.message || 'Gagal simpan reject' });
        } finally { setSubmitting(false); }
    };

    const monthLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const totalQty = rejects.reduce((s, r) => s + (r.quantity || 0), 0);
    const totalValue = rejects.reduce((s, r) => s + Number(r.totalCost || 0), 0);

    return (
        <div className="bg-white rounded-xl border border-orange-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                    <h3 className="font-bold text-base flex items-center gap-2">⚠️ Reject Mesin</h3>
                    <p className="text-xs text-gray-500">Cabang: <span className="font-semibold">{branchName || `#${branchId}`}</span> · Catat klik gagal/test/kalibrasi (bulan {monthLabel})</p>
                </div>
                <button onClick={() => setShowForm(s => !s)}
                    className="text-sm px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold">
                    {showForm ? '✕ Tutup' : '+ Catat Reject'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="space-y-3 border-t pt-3 mb-4">
                    {/* Tanggal & cause */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Tanggal</label>
                            <input type="date" value={form.date} required
                                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Penyebab</label>
                            <div className="flex gap-2">
                                <label className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border-2 cursor-pointer text-sm ${form.cause === 'MACHINE' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold' : 'border-gray-200'}`}>
                                    <input type="radio" name="cause" className="hidden"
                                        checked={form.cause === 'MACHINE'}
                                        onChange={() => setForm(f => ({ ...f, cause: 'MACHINE' }))} />
                                    🔧 Mesin
                                </label>
                                <label className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border-2 cursor-pointer text-sm ${form.cause === 'HUMAN' ? 'border-amber-500 bg-amber-50 text-amber-700 font-semibold' : 'border-gray-200'}`}>
                                    <input type="radio" name="cause" className="hidden"
                                        checked={form.cause === 'HUMAN'}
                                        onChange={() => setForm(f => ({ ...f, cause: 'HUMAN' }))} />
                                    👤 Operator
                                </label>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">Mesin = vendor bebaskan · Operator = tetap ditagih</p>
                        </div>
                    </div>

                    {/* Tipe & counter type */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Jenis Reject</label>
                            <select value={form.rejectType}
                                onChange={e => setForm(f => ({ ...f, rejectType: e.target.value as RejectType }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                {REJECT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Mode Counter</label>
                            <select value={form.counterType}
                                onChange={e => setForm(f => ({ ...f, counterType: e.target.value as CounterType }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                {COUNTER_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Jumlah & harga */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Jumlah Klik</label>
                            <input type="number" min={0} value={form.quantity || ''} required
                                onChange={e => setForm(f => ({ ...f, quantity: +e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                                placeholder="contoh: 25" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Harga / Klik (Rp) <span className="text-gray-400 font-normal">opsional</span></label>
                            <input type="number" min={0} value={form.pricePerClick || ''}
                                onChange={e => setForm(f => ({ ...f, pricePerClick: +e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                                placeholder="kosongkan = pakai default" />
                        </div>
                    </div>

                    {/* Total */}
                    {form.quantity > 0 && form.pricePerClick > 0 && (
                        <div className="text-sm bg-orange-50 border border-orange-200 px-3 py-2 rounded-lg text-orange-800">
                            Total nilai: <span className="font-bold">Rp {totalCost.toLocaleString('id-ID')}</span>
                        </div>
                    )}

                    {/* Foto */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Foto Bukti (opsional)</label>
                        {form.photoUrl ? (
                            <div className="flex items-start gap-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={resolvePhotoUrl(form.photoUrl) || form.photoUrl} alt="Foto reject" loading="lazy" decoding="async" className="w-32 h-32 object-cover rounded-lg border" />
                                <button type="button" onClick={() => setForm(f => ({ ...f, photoUrl: '' }))}
                                    className="text-xs text-red-600 hover:underline">Hapus</button>
                            </div>
                        ) : (
                            <label className={`flex items-center gap-2 border-2 border-dashed rounded-lg px-3 py-3 cursor-pointer hover:bg-gray-50 text-sm text-gray-500 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                                {uploading ? '⏳ Mengupload…' : '📷 Pilih / ambil foto'}
                                <input type="file" accept="image/*" capture="environment"
                                    onChange={handleUpload} className="hidden" />
                            </label>
                        )}
                    </div>

                    {/* Catatan */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Catatan (opsional)</label>
                        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="contoh: head clogged, perlu cleaning" />
                    </div>

                    {toast && (
                        <div className={`text-sm px-3 py-2 rounded-lg ${toast.kind === 'ok'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {toast.msg}
                        </div>
                    )}

                    <button type="submit" disabled={submitting || form.quantity <= 0}
                        className="w-full sm:w-auto px-6 py-2.5 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 disabled:opacity-50">
                        {submitting ? 'Menyimpan…' : '💾 Simpan Reject'}
                    </button>
                </form>
            )}

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-orange-50 rounded-lg px-3 py-2 border border-orange-100">
                    <div className="text-[10px] uppercase text-orange-600 font-semibold">Total Klik Reject</div>
                    <div className="text-lg font-bold text-orange-800 font-mono">{totalQty.toLocaleString('id-ID')}</div>
                </div>
                <div className="bg-orange-50 rounded-lg px-3 py-2 border border-orange-100">
                    <div className="text-[10px] uppercase text-orange-600 font-semibold">Total Nilai</div>
                    <div className="text-lg font-bold text-orange-800 font-mono">Rp {totalValue.toLocaleString('id-ID')}</div>
                </div>
            </div>

            {/* History */}
            {loading ? (
                <p className="text-sm text-gray-500 text-center py-4">Memuat…</p>
            ) : rejects.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Belum ada reject bulan ini.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-xs text-gray-500 uppercase">
                                <th className="text-left py-2 px-2">Tanggal</th>
                                <th className="text-left py-2 px-2">Jenis</th>
                                <th className="text-left py-2 px-2">Penyebab</th>
                                <th className="text-right py-2 px-2">Qty</th>
                                <th className="text-right py-2 px-2">Nilai</th>
                                <th className="text-center py-2 px-2">Foto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rejects.map(r => (
                                <tr key={r.id} className="border-t hover:bg-gray-50">
                                    <td className="py-2 px-2">{fmtDate(r.date)}</td>
                                    <td className="py-2 px-2">{REJECT_TYPE_OPTIONS.find(o => o.value === r.rejectType)?.label || r.rejectType}</td>
                                    <td className="py-2 px-2">
                                        {r.cause === 'MACHINE'
                                            ? <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700 font-semibold">🔧 Mesin</span>
                                            : <span className="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 font-semibold">👤 Operator</span>}
                                    </td>
                                    <td className="py-2 px-2 text-right font-mono font-bold">{r.quantity.toLocaleString('id-ID')}</td>
                                    <td className="py-2 px-2 text-right font-mono">Rp {Number(r.totalCost || 0).toLocaleString('id-ID')}</td>
                                    <td className="py-2 px-2 text-center">
                                        {r.photoUrl ? (
                                            <a href={r.photoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-600 hover:underline">📷 Lihat</a>
                                        ) : <span className="text-gray-300">—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
