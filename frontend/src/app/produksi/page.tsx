"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    getProductionJobs, getProductionRolls, getProductionStats,
    verifyOperatorPin, startProductionJob, completeProductionJob,
    pickupProductionJob, createProductionBatch, completeProductionBatch,
    startAssemblyJob, completeAssemblyJob,
} from '@/lib/api';
import { getPublicBranches, PublicBranch } from '@/lib/api/production';
import {
    Tab, PIN_KEY, PIN_TTL,
    getStoredSession, saveSession, clearSession,
    formatDeadline, getDimLabel, getAreaM2, suggestRolls, getLongerDim, getSambungInfo, getDimsInCm,
} from './produksi-utils';
import { JobCard } from './JobCard';
import { Footer } from '@/components/layout/Footer';

// ── component ─────────────────────────────────────────────────────────────────
export default function ProduksiPage() {
    const [authed, setAuthed] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [pinLoading, setPinLoading] = useState(false);

    // Multi-cabang: branchId dipilih sebelum PIN. PIN di-verify per cabang.
    const [branches, setBranches] = useState<PublicBranch[]>([]);
    const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
    const [activeBranchName, setActiveBranchName] = useState<string | null>(null);
    const [activeBranchCode, setActiveBranchCode] = useState<string | null>(null);

    const [tab, setTab] = useState<Tab>('ANTRIAN');
    const [jobs, setJobs] = useState<any[]>([]);
    const [rolls, setRolls] = useState<any[]>([]);
    const [stats, setStats] = useState({ antrian: 0, proses: 0, menungguPasang: 0, pasang: 0, selesai: 0 });
    const [loading, setLoading] = useState(false);

    // Gang print mode
    const [gangMode, setGangMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Process modal (single job)
    const [processModal, setProcessModal] = useState<{ open: boolean; job: any | null }>({ open: false, job: null });
    const [useWaste, setUseWaste] = useState(false);
    const [selectedRollId, setSelectedRollId] = useState<number | null>(null);
    const [rollSearch, setRollSearch] = useState('');
    const [opNote, setOpNote] = useState('');
    const [batchRollSearch, setBatchRollSearch] = useState('');
    const [modalLoading, setModalLoading] = useState(false);

    // Batch modal
    const [batchModal, setBatchModal] = useState(false);
    const [batchUseWaste, setBatchUseWaste] = useState(false);
    const [batchRollId, setBatchRollId] = useState<number | null>(null);

    // Assembly modal
    const [assemblyModal, setAssemblyModal] = useState<{ open: boolean; job: any | null }>({ open: false, job: null });
    const [assemblyNote, setAssemblyNote] = useState('');

    // Search & detail
    const [searchQuery, setSearchQuery] = useState('');
    const [detailJob, setDetailJob] = useState<any | null>(null);

    const refreshInterval = useRef<NodeJS.Timeout | null>(null);

    // Load branches + check stored PIN session on mount
    useEffect(() => {
        getPublicBranches().then(setBranches).catch(() => setBranches([]));
        const session = getStoredSession();
        if (session) {
            setActiveBranchId(session.branchId);
            setActiveBranchName(session.branchName);
            setActiveBranchCode(session.branchCode);
            setAuthed(true);
        }
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const bid = activeBranchId ?? undefined;
            const [j, r, s] = await Promise.all([
                getProductionJobs(undefined, bid),
                getProductionRolls(bid),
                getProductionStats(bid),
            ]);
            setJobs(j);
            setRolls(r);
            setStats({ antrian: s.antrian ?? 0, proses: s.proses ?? 0, menungguPasang: s.menungguPasang ?? 0, pasang: s.pasang ?? 0, selesai: s.selesai ?? 0 });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        if (!authed) return;
        loadData();
        refreshInterval.current = setInterval(loadData, 30000);
        return () => { if (refreshInterval.current) clearInterval(refreshInterval.current); };
    }, [authed, loadData]);

    // ── PIN verification ───────────────────────────────────────────────────────
    const handlePinSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pinInput) return;
        if (branches.length > 1 && activeBranchId == null) {
            setPinError('Pilih cabang terlebih dahulu');
            return;
        }
        setPinLoading(true);
        setPinError('');
        try {
            // Kalau cuma 1 cabang aktif, auto-pilih supaya UX simpel
            const bid = activeBranchId ?? (branches.length === 1 ? branches[0].id : null);
            const branch = branches.find(b => b.id === bid) || null;
            const res = await verifyOperatorPin(pinInput, bid ?? undefined);
            if (res.valid) {
                saveSession(bid, branch?.name ?? null, branch?.code ?? null);
                if (bid && branch) {
                    setActiveBranchId(bid);
                    setActiveBranchName(branch.name);
                    setActiveBranchCode(branch.code);
                }
                setAuthed(true);
            } else {
                setPinError(res.message || 'PIN salah. Coba lagi.');
                setPinInput('');
            }
        } catch {
            setPinError('Gagal menghubungi server.');
        } finally {
            setPinLoading(false);
        }
    };

    // Logout — clear session + reset state, kembali ke pin/branch picker
    const handleLogout = () => {
        clearSession();
        setAuthed(false);
        setActiveBranchId(null);
        setActiveBranchName(null);
        setActiveBranchCode(null);
        setPinInput('');
    };

    // ── filter jobs by tab + search ────────────────────────────────────────────
    const filteredJobs = jobs.filter(j => {
        if (j.status !== tab) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            (j.transaction?.customerName ?? '').toLowerCase().includes(q) ||
            (j.transaction?.invoiceNumber ?? '').toLowerCase().includes(q) ||
            (j.jobNumber ?? '').toLowerCase().includes(q)
        );
    });

    // ── roll helpers ───────────────────────────────────────────────────────────
    const maxRollEffectiveWidth = rolls.reduce((max: number, r: any) =>
        Math.max(max, Number(r.rollEffectivePrintWidth ?? r.rollPhysicalWidth ?? 0)), 0);

    // ── gang mode helpers ──────────────────────────────────────────────────────
    const toggleSelect = (id: number) => {
        const job = filteredJobs.find(j => j.id === id);
        if (job && maxRollEffectiveWidth > 0) {
            // Normalisasi ke cm dulu (item bisa input m atau cm — keduanya disimpan di widthCm/heightCm)
            const dimsCm = getDimsInCm(job);
            // Hanya blok jika job ini SENDIRI perlu cetak sambung (lebih lebar dari roll)
            // Saat gabung cetak, job dicetak berurutan sepanjang roll — panjang roll bisa 70m+
            // sehingga tidak ada batasan total lebar dari semua job yang digabung
            if (getSambungInfo(dimsCm?.widthCm ?? null, dimsCm?.heightCm ?? null, maxRollEffectiveWidth).needsSambung) {
                alert('Job ini perlu cetak SAMBUNG (melebihi lebar roll). Tidak bisa digabung — proses secara individual.');
                return;
            }
        }
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectedJobs = filteredJobs.filter(j => selectedIds.has(j.id));

    // Total area (m²) for all selected jobs — used for stock deduction
    const batchTotalAreaM2 = selectedJobs.reduce((sum, j) => sum + getAreaM2(j), 0);

    // ── open process modal ─────────────────────────────────────────────────────
    const openProcess = (job: any) => {
        setProcessModal({ open: true, job });
        setUseWaste(false);
        setSelectedRollId(null);
        setRollSearch('');
        setOpNote('');
    };

    // ── actions ────────────────────────────────────────────────────────────────
    const isUnitJob = (job: any) =>
        job?.transactionItem?.productVariant?.product?.pricingMode === 'UNIT';

    const handleStartJob = async () => {
        if (!processModal.job) return;
        const unitJob = isUnitJob(processModal.job);
        if (!unitJob && !useWaste && !selectedRollId) {
            alert('Pilih bahan yang akan digunakan.');
            return;
        }
        const jobAreaM2 = getAreaM2(processModal.job);
        setModalLoading(true);
        try {
            await startProductionJob(processModal.job.id, {
                rollVariantId: unitJob ? undefined : (useWaste ? undefined : selectedRollId!),
                usedWaste: unitJob ? false : useWaste,
                rollAreaM2: unitJob ? undefined : (useWaste ? undefined : jobAreaM2),
                operatorNote: opNote || undefined,
            });
            setProcessModal({ open: false, job: null });
            await loadData();
        } catch (e: any) {
            alert(e.message || 'Gagal memulai job');
        } finally {
            setModalLoading(false);
        }
    };

    const handleCompleteJob = async (id: number) => {
        if (!confirm('Tandai job ini sebagai SELESAI?')) return;
        try {
            await completeProductionJob(id);
            await loadData();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handlePickupJob = async (id: number) => {
        if (!confirm('Tandai pesanan ini sudah DIAMBIL pelanggan?')) return;
        try {
            await pickupProductionJob(id);
            await loadData();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleCreateBatch = async () => {
        if (!batchUseWaste && !batchRollId) {
            alert('Pilih bahan yang akan digunakan.');
            return;
        }
        setModalLoading(true);
        try {
            await createProductionBatch({
                jobIds: Array.from(selectedIds),
                rollVariantId: batchUseWaste ? undefined : batchRollId!,
                usedWaste: batchUseWaste,
                totalAreaM2: batchUseWaste ? undefined : batchTotalAreaM2,
            });
            setSelectedIds(new Set());
            setGangMode(false);
            setBatchModal(false);
            setTab('PROSES');
            await loadData();
        } catch (e: any) {
            alert(e.message || 'Gagal membuat batch');
        } finally {
            setModalLoading(false);
        }
    };

    const handleCompleteBatch = async (batchId: number) => {
        if (!confirm('Tandai semua job dalam batch ini sebagai SELESAI?')) return;
        try {
            await completeProductionBatch(batchId);
            await loadData();
        } catch (e: any) {
            alert(e.message);
        }
    };

    // ── assembly actions ────────────────────────────────────────────────────────
    const openAssemblyModal = (job: any) => {
        setAssemblyModal({ open: true, job });
        setAssemblyNote('');
    };

    const handleStartAssembly = async () => {
        if (!assemblyModal.job) return;
        setModalLoading(true);
        try {
            await startAssemblyJob(assemblyModal.job.id, assemblyNote || undefined);
            setAssemblyModal({ open: false, job: null });
            await loadData();
        } catch (e: any) {
            alert(e.message || 'Gagal memulai pemasangan');
        } finally {
            setModalLoading(false);
        }
    };

    const handleCompleteAssembly = async (id: number) => {
        if (!confirm('Tandai job ini sebagai selesai pemasangan?')) return;
        try {
            await completeAssemblyJob(id);
            await loadData();
        } catch (e: any) {
            alert(e.message || 'Gagal menyelesaikan pemasangan');
        }
    };

    // ── open batch modal ───────────────────────────────────────────────────────
    const openBatchModal = () => {
        if (selectedIds.size < 2) { alert('Pilih minimal 2 job untuk digabung.'); return; }
        setBatchModal(true);
        setBatchUseWaste(false);
        setBatchRollId(null);
        setBatchRollSearch('');
    };

    // ── PIN SCREEN ─────────────────────────────────────────────────────────────
    if (!authed) {
        const showBranchPicker = branches.length > 1;
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-sm">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Antrian Produksi</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            {showBranchPicker ? 'Pilih cabang & masukkan PIN operator' : 'Masukkan PIN operator untuk mengakses'}
                        </p>
                    </div>

                    <form onSubmit={handlePinSubmit} className="space-y-4">
                        {showBranchPicker && (
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                                    Cabang
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {branches.map(b => (
                                        <button
                                            key={b.id}
                                            type="button"
                                            onClick={() => setActiveBranchId(b.id)}
                                            className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                                                activeBranchId === b.id
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-border bg-background hover:border-primary/40'
                                            }`}
                                        >
                                            <span className="font-semibold text-sm">{b.name}</span>
                                            {b.code && (
                                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                                                    activeBranchId === b.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                                }`}>{b.code}</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                                PIN Operator
                            </label>
                            <input
                                type="password" inputMode="numeric" pattern="[0-9]*"
                                value={pinInput}
                                onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                                maxLength={6}
                                placeholder="••••"
                                autoFocus={!showBranchPicker}
                                className="w-full text-center text-3xl tracking-[1rem] font-mono px-4 py-4 border-2 border-border bg-background rounded-2xl focus:border-primary outline-none transition-colors"
                            />
                        </div>

                        {pinError && (
                            <div className="text-center text-sm text-red-500 font-medium">{pinError}</div>
                        )}
                        <button type="submit" disabled={pinLoading || pinInput.length < 4}
                            className="w-full py-4 bg-primary text-primary-foreground font-bold text-lg rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-transform">
                            {pinLoading ? 'Memverifikasi...' : 'Masuk'}
                        </button>
                    </form>

                    <p className="text-center text-xs text-muted-foreground mt-6">
                        PIN per cabang. Berlaku 24 jam di perangkat ini.
                    </p>

                    <div className="mt-4 text-center">
                        <a href="/pos" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
                            ← Kembali ke Kasir
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // ── QUEUE SCREEN ───────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="font-bold text-sm text-foreground flex items-center gap-2">
                            Antrian Produksi
                            {activeBranchCode && (
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-primary/15 text-primary border border-primary/30 rounded-full">
                                    {activeBranchCode}
                                </span>
                            )}
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            {activeBranchName ? `${activeBranchName} · Auto refresh 30 detik` : 'Auto refresh 30 detik'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadData} disabled={loading}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                        <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                    <button onClick={handleLogout}
                        className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
                        Keluar
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="bg-card border-b border-border px-4 flex gap-1 overflow-x-auto">
                {([
                    { key: 'ANTRIAN', label: 'Antrian', count: stats.antrian, color: 'text-amber-600' },
                    { key: 'PROSES', label: 'Proses', count: stats.proses, color: 'text-blue-600' },
                    { key: 'MENUNGGU_PASANG', label: 'Menunggu Pasang', count: stats.menungguPasang, color: 'text-orange-600' },
                    { key: 'PASANG', label: 'Dipasang', count: stats.pasang, color: 'text-amber-700' },
                    { key: 'SELESAI', label: 'Selesai', count: stats.selesai, color: 'text-green-600' },
                    { key: 'DIAMBIL', label: 'Diambil', count: null, color: 'text-muted-foreground' },
                ] as const).map(t => (
                    <button key={t.key} onClick={() => { setTab(t.key); setGangMode(false); setSelectedIds(new Set()); }}
                        className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                        {t.label}
                        {t.count !== null && t.count > 0 && (
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full bg-muted ${t.color}`}>{t.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Search bar */}
            <div className="bg-background border-b border-border px-4 py-2.5">
                <div className="relative max-w-2xl mx-auto">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Cari nama pelanggan, no. invoice, no. job..."
                        className="w-full pl-9 pr-9 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Gang mode toolbar */}
            {tab === 'ANTRIAN' && (
                <div className="bg-card/50 border-b border-border px-4 py-2 flex items-center justify-between">
                    <button onClick={() => { setGangMode(!gangMode); setSelectedIds(new Set()); }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${gangMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        {gangMode ? 'Mode Gabung Aktif' : 'Gabung Cetak'}
                    </button>

                    {gangMode && selectedIds.size > 0 && (
                        <div className="flex items-center gap-3">
                            <div className="text-xs text-right">
                                <p className="font-bold text-foreground">{batchTotalAreaM2.toFixed(2)} m²</p>
                                <p className="text-muted-foreground">total luas</p>
                            </div>
                            {selectedIds.size >= 2 && (
                                <button onClick={openBatchModal}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold transition-colors">
                                    Gabung {selectedIds.size} Job
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Job list */}
            <main className="flex-1 p-4 space-y-3 max-w-2xl mx-auto w-full pb-24">
                {filteredJobs.length === 0 && !loading && (
                    <div className="text-center py-16 text-muted-foreground">
                        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p className="font-medium">{searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : 'Tidak ada job di tab ini'}</p>
                        {searchQuery && <button onClick={() => setSearchQuery('')} className="mt-2 text-xs text-primary underline">Hapus pencarian</button>}
                    </div>
                )}

                {/* Group by batch for PROSES tab */}
                {tab === 'PROSES' ? (
                    (() => {
                        const batchMap: Record<number, any[]> = {};
                        const soloJobs: any[] = [];
                        filteredJobs.forEach(j => {
                            if (j.batchId) {
                                if (!batchMap[j.batchId]) batchMap[j.batchId] = [];
                                batchMap[j.batchId].push(j);
                            } else {
                                soloJobs.push(j);
                            }
                        });

                        return (
                            <>
                                {Object.entries(batchMap).map(([batchId, batchJobs]) => (
                                    <div key={batchId} className="border-2 border-blue-500/30 rounded-xl overflow-hidden bg-blue-500/5">
                                        <div className="px-4 py-2 bg-blue-500/10 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-blue-600">GABUNG CETAK</span>
                                                <span className="text-xs text-muted-foreground">{batchJobs[0]?.batch?.batchNumber}</span>
                                                <span className="text-xs text-muted-foreground">• {batchJobs.length} job</span>
                                            </div>
                                            <button onClick={() => handleCompleteBatch(Number(batchId))}
                                                className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-lg">
                                                Selesai Semua
                                            </button>
                                        </div>
                                        <div className="divide-y divide-border">
                                            {batchJobs.map(j => <JobCard key={j.id} job={j} tab={tab} gangMode={false} selected={false} onSelect={() => {}} onProcess={() => {}} onComplete={handleCompleteJob} onPickup={handlePickupJob} onStartAssembly={openAssemblyModal} onCompleteAssembly={handleCompleteAssembly} onDetail={setDetailJob} maxRollEffectiveWidth={maxRollEffectiveWidth} />)}
                                        </div>
                                    </div>
                                ))}
                                {soloJobs.map(j => (
                                    <JobCard key={j.id} job={j} tab={tab} gangMode={false} selected={false} onSelect={() => {}} onProcess={() => {}} onComplete={handleCompleteJob} onPickup={handlePickupJob} onStartAssembly={openAssemblyModal} onCompleteAssembly={handleCompleteAssembly} onDetail={setDetailJob} maxRollEffectiveWidth={maxRollEffectiveWidth} />
                                ))}
                            </>
                        );
                    })()
                ) : (
                    filteredJobs.map(j => (
                        <JobCard key={j.id} job={j} tab={tab} gangMode={gangMode} selected={selectedIds.has(j.id)}
                            onSelect={() => toggleSelect(j.id)} onProcess={() => openProcess(j)}
                            onComplete={handleCompleteJob} onPickup={handlePickupJob}
                            onStartAssembly={openAssemblyModal} onCompleteAssembly={handleCompleteAssembly}
                            onDetail={setDetailJob} maxRollEffectiveWidth={maxRollEffectiveWidth} />
                    ))
                )}

                {/* Footer */}
                <Footer />
            </main>

            {/* ── Process Modal ─────────────────────────────────────────────────────── */}
            {processModal.open && processModal.job && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <div>
                                <h2 className="font-bold">Proses Job #{processModal.job.jobNumber}</h2>
                                <p className="text-xs text-muted-foreground">
                                    {processModal.job.transactionItem?.productVariant?.product?.name}
                                    {isUnitJob(processModal.job)
                                        ? ` · ${processModal.job.transactionItem?.quantity ?? 1} pcs`
                                        : getDimLabel(processModal.job) ? ` · ${getDimLabel(processModal.job)}` : ''}
                                </p>
                            </div>
                            <button onClick={() => setProcessModal({ open: false, job: null })}
                                className="p-1 text-muted-foreground hover:text-foreground">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-4 space-y-4">
                            {/* Order info */}
                            {processModal.job.transactionItem?.note && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
                                    <span className="font-semibold text-amber-700">Catatan: </span>
                                    {processModal.job.transactionItem.note}
                                </div>
                            )}
                            {processModal.job.notes && (
                                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
                                    <span className="font-semibold">Catatan Produksi: </span>
                                    {processModal.job.notes}
                                </div>
                            )}

                            {/* Material choice — hanya untuk produk AREA_BASED */}
                            {!isUnitJob(processModal.job) && (
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">Pilih Bahan</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[false, true].map(isWaste => (
                                            <button key={String(isWaste)} type="button" onClick={() => setUseWaste(isWaste)}
                                                className={`py-3 rounded-xl border-2 text-sm font-medium transition-all ${useWaste === isWaste ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                                                {isWaste ? 'Sisa / Waste' : 'Bahan Baru (Potong Stok)'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!isUnitJob(processModal.job) && !useWaste && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold">Pilih Bahan dari Stok</label>
                                        <input
                                            type="text" value={rollSearch}
                                            onChange={e => setRollSearch(e.target.value)}
                                            placeholder="Cari nama produk..."
                                            className="w-full px-3 py-2 border border-border bg-background rounded-xl outline-none focus:border-primary text-sm"
                                        />
                                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                            {rolls.filter(r => `${r.product?.name} ${r.variantName ?? ''}`.toLowerCase().includes(rollSearch.toLowerCase())).map((roll: any) => {
                                                const jobArea = getAreaM2(processModal.job);
                                                const stockM2 = Number(roll.stock);
                                                const afterDeduct = stockM2 - Math.ceil(jobArea);
                                                const cukup = afterDeduct >= 0;
                                                return (
                                                    <button key={roll.id} type="button" onClick={() => setSelectedRollId(roll.id)}
                                                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${selectedRollId === roll.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30'}`}>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold truncate">{roll.product?.name}{roll.variantName ? ` — ${roll.variantName}` : ''}</p>
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {roll.product?.productType === 'RAW_MATERIAL'
                                                                        ? <span className="text-[10px] font-bold px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-md">Bahan Baku</span>
                                                                        : <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md">Produk Jual</span>
                                                                    }
                                                                    {roll.product?.category?.name && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded-md">{roll.product.category.name}</span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground mt-1">
                                                                    Stok: {stockM2} m² {cukup ? `→ sisa ${afterDeduct} m²` : '(stok kurang)'}
                                                                </p>
                                                            </div>
                                                            <div className="shrink-0 mt-0.5">
                                                                {cukup
                                                                    ? <span className="text-xs px-2 py-0.5 bg-green-500/15 text-green-700 rounded-full font-medium">Cukup</span>
                                                                    : <span className="text-xs px-2 py-0.5 bg-red-500/15 text-red-600 rounded-full font-medium">Kurang</span>
                                                                }
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                            {rolls.length === 0 && (
                                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-700">
                                                    <p className="font-semibold">Belum ada produk di inventory.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Area info */}
                                    {(() => {
                                        const areaM2 = getAreaM2(processModal.job);
                                        const roll = rolls.find((r: any) => r.id === selectedRollId);
                                        const eff = roll ? Number(roll.rollEffectivePrintWidth ?? roll.rollPhysicalWidth ?? 0) : 0;
                                        // Normalisasi dimensi ke cm berdasarkan unitType (m vs cm)
                                        const dimsCm = getDimsInCm(processModal.job);
                                        const sambung = eff > 0
                                            ? getSambungInfo(dimsCm?.widthCm ?? null, dimsCm?.heightCm ?? null, eff)
                                            : { needsSambung: false, strips: 1, stripWidth: 0 };
                                        return (
                                            <div className={`p-3 rounded-xl border text-sm space-y-1 ${sambung.needsSambung ? 'bg-orange-500/10 border-orange-500/20' : 'bg-muted/40 border-border'}`}>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground">Luas cetak</span>
                                                    <span className="font-bold text-lg">{areaM2.toFixed(2)} m² <span className="text-sm font-normal text-muted-foreground">({Math.round(areaM2 * 10000).toLocaleString('id-ID')} cm²)</span></span>
                                                </div>
                                                {selectedRollId && roll && (
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-muted-foreground">Stok bahan setelah dipotong</span>
                                                        <span className={`font-semibold ${Number(roll.stock) - Math.ceil(areaM2) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                            {Number(roll.stock) - Math.ceil(areaM2)} m²
                                                        </span>
                                                    </div>
                                                )}
                                                {sambung.needsSambung && (
                                                    <p className="text-xs text-orange-600 pt-1 border-t border-orange-500/20">
                                                        ⚠ Perlu cetak sambung {sambung.strips}× (lebar {sambung.stripWidth} cm per pass)
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </>
                            )}

                            <div className="space-y-1">
                                <label className="text-sm font-semibold">Catatan Operator (opsional)</label>
                                <textarea rows={2} value={opNote} onChange={e => setOpNote(e.target.value)}
                                    placeholder="Catatan proses, setting mesin, dll."
                                    className="w-full px-3 py-2 border border-border bg-background rounded-xl outline-none focus:border-primary text-sm resize-none" />
                            </div>
                        </div>

                        <div className="p-4 border-t border-border flex gap-3">
                            <button type="button" onClick={() => setProcessModal({ open: false, job: null })}
                                className="flex-1 py-3 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
                                Batal
                            </button>
                            <button type="button" onClick={handleStartJob} disabled={modalLoading}
                                className="flex-[2] py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50 transition-colors">
                                {modalLoading ? 'Memproses...' : isUnitJob(processModal.job) ? 'Mulai Pengerjaan' : 'Mulai Cetak'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Batch Modal ───────────────────────────────────────────────────────── */}
            {batchModal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <div>
                                <h2 className="font-bold">Gabung Cetak — {selectedIds.size} Job</h2>
                                <p className="text-xs text-muted-foreground">
                                    Total luas: <span className="font-bold text-foreground">{batchTotalAreaM2.toFixed(2)} m²</span>
                                </p>
                            </div>
                            <button onClick={() => setBatchModal(false)} className="p-1 text-muted-foreground hover:text-foreground">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-4 space-y-4">
                            {/* Summary */}
                            <div className="bg-muted/40 rounded-xl p-3 space-y-1 text-sm">
                                {selectedJobs.map(j => (
                                    <div key={j.id} className="flex items-center justify-between">
                                        <span className="text-muted-foreground truncate pr-2">{j.transaction?.invoiceNumber} · {j.transactionItem?.productVariant?.product?.name}</span>
                                        <span className="font-mono text-xs shrink-0">{getDimLabel(j)} = <span className="font-semibold">{getAreaM2(j).toFixed(2)} m²</span> <span className="text-muted-foreground">({Math.round(getAreaM2(j) * 10000).toLocaleString('id-ID')} cm²)</span></span>
                                    </div>
                                ))}
                                <div className="border-t border-border pt-2 mt-2 flex justify-between font-bold">
                                    <span>Total luas bahan</span>
                                    <span>{batchTotalAreaM2.toFixed(2)} m²</span>
                                </div>
                            </div>

                            {/* Material choice */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Pilih Bahan</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[false, true].map(isWaste => (
                                        <button key={String(isWaste)} type="button" onClick={() => setBatchUseWaste(isWaste)}
                                            className={`py-3 rounded-xl border-2 text-sm font-medium transition-all ${batchUseWaste === isWaste ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                                            {isWaste ? 'Sisa / Waste' : 'Bahan Baru (Potong Stok)'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {!batchUseWaste && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold">Pilih Bahan dari Stok</label>
                                        <input
                                            type="text" value={batchRollSearch}
                                            onChange={e => setBatchRollSearch(e.target.value)}
                                            placeholder="Cari nama produk..."
                                            className="w-full px-3 py-2 border border-border bg-background rounded-xl outline-none focus:border-primary text-sm"
                                        />
                                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                            {rolls.length === 0 && (
                                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-700">
                                                    <p className="font-semibold">Belum ada produk di stok.</p>
                                                    <p className="text-xs mt-1">Pastikan sudah ada produk di Inventory dan backend sudah di-restart setelah perubahan terakhir.</p>
                                                </div>
                                            )}
                                            {rolls.filter(r => `${r.product?.name} ${r.variantName ?? ''}`.toLowerCase().includes(batchRollSearch.toLowerCase())).map(r => {
                                                const stockM2 = Number(r.stock);
                                                const afterDeduct = stockM2 - Math.ceil(batchTotalAreaM2);
                                                const cukup = afterDeduct >= 0;
                                                return (
                                                    <button key={r.id} type="button" onClick={() => setBatchRollId(r.id)}
                                                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${batchRollId === r.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30'}`}>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold truncate">{r.product?.name}{r.variantName ? ` — ${r.variantName}` : ''}</p>
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {r.product?.productType === 'RAW_MATERIAL'
                                                                        ? <span className="text-[10px] font-bold px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-md">Bahan Baku</span>
                                                                        : <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md">Produk Jual</span>
                                                                    }
                                                                    {r.product?.category?.name && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded-md">{r.product.category.name}</span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground mt-1">
                                                                    Stok: {stockM2} m² {cukup ? `→ sisa ${afterDeduct} m²` : '(stok kurang)'}
                                                                </p>
                                                            </div>
                                                            <div className="shrink-0 mt-0.5">
                                                                {cukup
                                                                    ? <span className="text-xs px-2 py-0.5 bg-green-500/15 text-green-700 rounded-full font-medium">Cukup</span>
                                                                    : <span className="text-xs px-2 py-0.5 bg-red-500/15 text-red-600 rounded-full font-medium">Kurang</span>
                                                                }
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="p-4 border-t border-border flex gap-3">
                            <button type="button" onClick={() => setBatchModal(false)}
                                className="flex-1 py-3 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
                                Batal
                            </button>
                            <button type="button" onClick={handleCreateBatch} disabled={modalLoading}
                                className="flex-[2] py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50 transition-colors">
                                {modalLoading ? 'Memproses...' : `Gabung & Mulai Cetak ${selectedIds.size} Job`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Assembly Modal ─────────────────────────────────────────────────────── */}
            {assemblyModal.open && assemblyModal.job && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <div>
                                <h2 className="font-bold">Mulai Pasang — #{assemblyModal.job.jobNumber}</h2>
                                <p className="text-xs text-muted-foreground">
                                    {assemblyModal.job.transactionItem?.productVariant?.product?.name} · {assemblyModal.job.transaction?.customerName || 'Tanpa nama'}
                                </p>
                            </div>
                            <button onClick={() => setAssemblyModal({ open: false, job: null })}
                                className="p-1 text-muted-foreground hover:text-foreground">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-4 space-y-4">
                            {/* BOM ingredients that will be deducted */}
                            {(() => {
                                const ingredients = assemblyModal.job.transactionItem?.productVariant?.product?.ingredients || [];
                                const linkedIngredients = ingredients.filter((ing: any) => ing.rawMaterialVariantId);
                                return ingredients.length > 0 ? (
                                    <div className="space-y-2">
                                        <p className="text-sm font-semibold">Komponen yang akan dipotong stok:</p>
                                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 divide-y divide-amber-500/20">
                                            {ingredients.map((ing: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                                    <span className="text-foreground font-medium">{ing.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-muted-foreground">{ing.quantity} {ing.unit}</span>
                                                        {ing.rawMaterialVariantId
                                                            ? <span className="text-xs px-1.5 py-0.5 bg-green-500/15 text-green-700 rounded font-medium">Terhubung stok</span>
                                                            : <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">Manual</span>
                                                        }
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {linkedIngredients.length === 0 && (
                                            <p className="text-xs text-muted-foreground">Tidak ada komponen yang terhubung ke stok — tidak ada pemotongan stok otomatis.</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-3 bg-muted/40 rounded-xl text-sm text-muted-foreground">
                                        Tidak ada komponen BOM terdaftar untuk produk ini.
                                    </div>
                                );
                            })()}

                            <div className="space-y-1">
                                <label className="text-sm font-semibold">Catatan Pemasangan (opsional)</label>
                                <textarea rows={2} value={assemblyNote} onChange={e => setAssemblyNote(e.target.value)}
                                    placeholder="Catatan proses pemasangan, jenis rangka, dll."
                                    className="w-full px-3 py-2 border border-border bg-background rounded-xl outline-none focus:border-primary text-sm resize-none" />
                            </div>
                        </div>

                        <div className="p-4 border-t border-border flex gap-3">
                            <button type="button" onClick={() => setAssemblyModal({ open: false, job: null })}
                                className="flex-1 py-3 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
                                Batal
                            </button>
                            <button type="button" onClick={handleStartAssembly} disabled={modalLoading}
                                className="flex-[2] py-3 bg-amber-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors">
                                {modalLoading ? 'Memproses...' : 'Konfirmasi Mulai Pasang'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Invoice Detail Modal ──────────────────────────────────────────────── */}
            {detailJob && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setDetailJob(null)}>
                    <div className="bg-card rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <div>
                                <h3 className="font-bold text-foreground">Detail Invoice</h3>
                                <p className="text-xs font-mono text-muted-foreground">{detailJob.transaction?.invoiceNumber ?? '—'}</p>
                            </div>
                            <button onClick={() => setDetailJob(null)}
                                className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
                            {/* Express / deadline banner */}
                            {(detailJob.priority === 'EXPRESS' || detailJob.transaction?.productionDeadline) && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
                                    {detailJob.priority === 'EXPRESS' && (
                                        <p className="text-xs font-bold text-red-600">⚡ EXPRESS ORDER</p>
                                    )}
                                    {detailJob.transaction?.productionDeadline && (
                                        <p className="text-xs text-red-600">
                                            Deadline: {new Date(detailJob.transaction.productionDeadline).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    )}
                                    {detailJob.transaction?.productionNotes && (
                                        <p className="text-xs text-red-600">{detailJob.transaction.productionNotes}</p>
                                    )}
                                </div>
                            )}

                            {/* Info rows */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Pelanggan</span>
                                    <span className="text-sm font-semibold">{detailJob.transaction?.customerName || 'Tanpa nama'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Tanggal</span>
                                    <span className="text-sm">{detailJob.transaction?.createdAt
                                        ? new Date(detailJob.transaction.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                        : '—'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Nomor Job</span>
                                    <span className="text-sm font-mono">{detailJob.jobNumber}</span>
                                </div>
                            </div>

                            <div className="border-t border-border" />

                            {/* Item detail */}
                            <div className="bg-muted/40 rounded-xl p-3 space-y-1.5">
                                <p className="text-sm font-semibold">{detailJob.transactionItem?.productVariant?.product?.name ?? '—'}</p>
                                {detailJob.transactionItem?.variantName && (
                                    <p className="text-xs text-muted-foreground">{detailJob.transactionItem.variantName}</p>
                                )}
                                {getDimLabel(detailJob) && (
                                    <p className="text-xs text-primary font-mono font-bold">{getDimLabel(detailJob)}</p>
                                )}
                                {detailJob.transactionItem?.quantity != null && (
                                    <p className="text-xs text-muted-foreground">
                                        Qty: {detailJob.transactionItem.quantity}
                                        {detailJob.transactionItem?.price != null && (
                                            <> × Rp {Number(detailJob.transactionItem.price).toLocaleString('id-ID')}</>
                                        )}
                                    </p>
                                )}
                                {detailJob.transactionItem?.note && (
                                    <p className="text-xs text-muted-foreground">Catatan: {detailJob.transactionItem.note}</p>
                                )}
                            </div>

                            <div className="border-t border-border" />

                            {/* Payment & total */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Pembayaran</span>
                                    <span className="text-sm font-medium capitalize">{(detailJob.transaction?.paymentMethod ?? '—').toLowerCase()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold">Total Invoice</span>
                                    <span className="text-sm font-bold text-primary">Rp {Number(detailJob.transaction?.total ?? 0).toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

