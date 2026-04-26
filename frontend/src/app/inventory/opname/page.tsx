'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getOpnameSessions, startOpnameSession, cancelOpnameSession,
    finishOpnameSession, getOpnameSessionDetail, getCategories, getWasteMovements,
} from '@/lib/api';
import {
    ClipboardList, Plus, X, CheckCircle2, Clock, Ban, ChevronRight,
    Copy, Check, AlertTriangle, RefreshCw, Loader2, ArrowLeft,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { ResponsiveTable, EmptyState } from '@/components/ui/responsive-table';

type OpnameStatus = 'ONGOING' | 'COMPLETED' | 'CANCELLED';

const STATUS_BADGE: Record<OpnameStatus, { label: string; cls: string }> = {
    ONGOING:   { label: 'Berlangsung', cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
    COMPLETED: { label: 'Selesai',     cls: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
    CANCELLED: { label: 'Dibatalkan',  cls: 'bg-red-500/15 text-red-600 border-red-500/30' },
};

function StatusBadge({ status }: { status: OpnameStatus }) {
    const s = STATUS_BADGE[status] ?? STATUS_BADGE.CANCELLED;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}>
            {s.label}
        </span>
    );
}

function CopyLinkButton({ token }: { token: string }) {
    const [copied, setCopied] = useState(false);
    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/opname/${token}`;

    const copy = () => {
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={copy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-medium transition-colors"
        >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Tersalin!' : 'Salin Link Operator'}
        </button>
    );
}

// ─── Modal Mulai Opname ───────────────────────────────────────────────────────
function StartModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
    const [notes, setNotes] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [expiresHours, setExpiresHours] = useState(24);
    const qc = useQueryClient();

    const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: getCategories });

    const mutation = useMutation({
        mutationFn: () => startOpnameSession({
            notes: notes.trim() || undefined,
            categoryId: categoryId ? Number(categoryId) : undefined,
            expiresHours,
        }),
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ['opname-sessions'] });
            onCreated(data.id);
        },
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">Mulai Stok Opname</h2>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5" /></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Catatan / Label Sesi</label>
                        <input
                            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            placeholder="Contoh: Opname Gudang Januari 2026"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Filter Kategori <span className="text-muted-foreground font-normal">(opsional)</span></label>
                        <select
                            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={categoryId}
                            onChange={e => setCategoryId(e.target.value)}
                        >
                            <option value="">Semua Produk</option>
                            {categories.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">Kosongkan untuk menghitung semua produk.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Link berlaku selama</label>
                        <select
                            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={expiresHours}
                            onChange={e => setExpiresHours(Number(e.target.value))}
                        >
                            <option value={8}>8 jam</option>
                            <option value={12}>12 jam</option>
                            <option value={24}>24 jam</option>
                            <option value={48}>48 jam</option>
                            <option value={72}>72 jam</option>
                        </select>
                    </div>
                </div>

                {mutation.isError && (
                    <p className="text-sm text-destructive">{(mutation.error as any)?.message}</p>
                )}

                <div className="flex gap-2 pt-1">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">
                        Batal
                    </button>
                    <button
                        onClick={() => mutation.mutate()}
                        disabled={mutation.isPending}
                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                        {mutation.isPending ? 'Membuat...' : 'Buat Link Opname'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Waste History per Variant ────────────────────────────────────────────────
function VariantWasteHistory({ variantId, since }: { variantId: number; since: string }) {
    const { data: waste = [] } = useQuery({
        queryKey: ['waste', variantId, since],
        queryFn: () => getWasteMovements(variantId, since),
        staleTime: 60_000,
    });

    if (!waste.length) return null;

    return (
        <div className="mt-1 space-y-0.5">
            {waste.map((w: any) => (
                <p key={w.id} className="text-[10px] text-amber-600 leading-tight">
                    {new Date(w.date).toLocaleDateString('id-ID')} — {w.reason} <span className="font-medium">(-{w.quantity})</span>
                </p>
            ))}
        </div>
    );
}

// ─── Detail Sesi + Review ─────────────────────────────────────────────────────
function SessionDetail({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
    const qc = useQueryClient();
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const { data: session, isLoading } = useQuery({
        queryKey: ['opname-session', sessionId],
        queryFn: () => getOpnameSessionDetail(sessionId),
        refetchInterval: (query) => query.state.data?.status === 'ONGOING' ? 10000 : false,
    });

    // confirmed stock state for each variant (pre-filled with latest input)
    const [confirmed, setConfirmed] = useState<Record<number, number>>({});

    // Build variant summary: { variantId → { product, variant, systemStock, inputs: [{operator, actual}] } }
    const variantMap = useMemo(() => {
        if (!session?.items) return new Map();
        const map = new Map<number, any>();
        for (const item of session.items) {
            const vid = item.productVariantId;
            if (!map.has(vid)) {
                map.set(vid, {
                    variantId: vid,
                    productName: item.productVariant.product.name,
                    imageUrl: item.productVariant.product.imageUrl,
                    variantName: item.productVariant.variantName,
                    systemStock: item.systemStock,
                    inputs: [],
                });
            }
            map.get(vid).inputs.push({ operator: item.operatorName, actual: item.actualStock, variance: item.variance, submittedAt: item.submittedAt, isEstimated: item.isEstimated, estimationNotes: item.estimationNotes });
        }
        return map;
    }, [session?.items]);

    // Init confirmed from latest inputs
    useMemo(() => {
        const init: Record<number, number> = {};
        variantMap.forEach((v, vid) => {
            if (!(vid in confirmed)) {
                init[vid] = v.inputs[0]?.actual ?? v.systemStock;
            }
        });
        if (Object.keys(init).length > 0) setConfirmed(prev => ({ ...init, ...prev }));
    }, [variantMap]);

    const cancelMutation = useMutation({
        mutationFn: () => cancelOpnameSession(sessionId),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['opname-sessions'] }); onBack(); },
    });

    const finishMutation = useMutation({
        mutationFn: () => finishOpnameSession(sessionId,
            Array.from(variantMap.keys()).map(vid => ({
                productVariantId: vid,
                confirmedStock: confirmed[vid] ?? variantMap.get(vid)?.systemStock ?? 0,
            }))
        ),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['opname-sessions'] }); onBack(); },
    });

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Memuat...</div>;
    if (!session) return <div className="p-8 text-center text-muted-foreground">Sesi tidak ditemukan</div>;

    const lookback30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const operators = [...new Set<string>(session.items.map((i: any) => i.operatorName as string))];
    const hasMismatch = Array.from(variantMap.values()).some((v: any) => {
        const latestActual = v.inputs[0]?.actual;
        return latestActual !== undefined && latestActual !== v.systemStock;
    });

    return (
        <div>
            {/* Header — back button + status */}
            <div className="mb-5 flex items-start gap-3">
                <button
                    onClick={onBack}
                    className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Kembali"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                            {session.notes || 'Stok Opname'}
                        </h1>
                        <StatusBadge status={session.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {session.category?.name ? `Kategori: ${session.category.name}` : 'Semua Produk'} ·
                        Mulai: {new Date(session.startDate).toLocaleString('id-ID')} ·
                        Kedaluwarsa: {new Date(session.expiresAt).toLocaleString('id-ID')}
                    </p>
                </div>
            </div>
            <div className="space-y-5">

            {/* Link + Operator Info */}
            {session.status === 'ONGOING' && (
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                            <p className="text-sm font-medium">Link untuk Karyawan</p>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5 break-all">
                                {typeof window !== 'undefined' ? window.location.origin : ''}/opname/{sessionId}
                            </p>
                        </div>
                        <CopyLinkButton token={sessionId} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Halaman ini refresh otomatis setiap 10 detik · Operator: {operators.length > 0 ? operators.join(', ') : 'Belum ada'}</span>
                    </div>
                </div>
            )}

            {/* Warning jika ada selisih */}
            {session.status === 'ONGOING' && hasMismatch && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Ada selisih stok yang perlu ditinjau sebelum diselesaikan.</span>
                </div>
            )}

            {/* Tabel Review */}
            {variantMap.size === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card">
                    <EmptyState
                        icon={ClipboardList}
                        title="Belum ada input"
                        description="Bagikan link operator ke karyawan supaya mereka bisa mulai mencatat stok."
                    />
                </div>
            ) : (
                <ResponsiveTable>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/40">
                                <th className="text-left p-3 font-medium">Produk</th>
                                <th className="text-center p-3 font-medium">Stok Sistem</th>
                                {operators.map(op => (
                                    <th key={op} className="text-center p-3 font-medium max-w-[120px]">{op}</th>
                                ))}
                                <th className="text-center p-3 font-medium text-primary">Selisih</th>
                                {session.status === 'ONGOING' && (
                                    <th className="text-center p-3 font-medium">Konfirmasi</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from(variantMap.values()).map((v: any) => {
                                const confirmedVal = confirmed[v.variantId] ?? v.systemStock;
                                const finalVariance = confirmedVal - v.systemStock;
                                const variantsByOp = Object.fromEntries(
                                    v.inputs.map((inp: any) => [inp.operator, inp])
                                );

                                return (
                                    <tr key={v.variantId} className="border-b border-border/50 hover:bg-muted/30">
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                {v.imageUrl && (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={`${base}${v.imageUrl}`} alt="" className="h-8 w-8 object-cover rounded" />
                                                )}
                                                <div>
                                                    <p className="font-medium">{v.productName}</p>
                                                    {v.variantName && <p className="text-xs text-muted-foreground">{v.variantName}</p>}
                                                    <VariantWasteHistory variantId={v.variantId} since={lookback30days} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-center font-mono">{v.systemStock}</td>
                                        {operators.map(op => {
                                            const inp = variantsByOp[op];
                                            return (
                                                <td key={op} className="p-3 text-center">
                                                    {inp ? (
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className={`font-mono font-medium ${inp.variance !== 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                                {inp.actual}
                                                            </span>
                                                            {inp.isEstimated && (
                                                                <span
                                                                    className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded cursor-help border border-amber-300"
                                                                    title={inp.estimationNotes ?? 'Nilai estimasi (tidak terukur tepat)'}
                                                                >
                                                                    ~Est.
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground/40">—</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="p-3 text-center font-mono font-semibold">
                                            <span className={finalVariance > 0 ? 'text-emerald-600' : finalVariance < 0 ? 'text-red-500' : 'text-muted-foreground'}>
                                                {finalVariance > 0 ? `+${finalVariance}` : finalVariance === 0 ? '✓' : finalVariance}
                                            </span>
                                        </td>
                                        {session.status === 'ONGOING' && (
                                            <td className="p-3 text-center">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    className="w-20 px-2 py-1 text-sm text-center border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                    value={confirmedVal}
                                                    onChange={e => setConfirmed(prev => ({ ...prev, [v.variantId]: Number(e.target.value) }))}
                                                />
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </ResponsiveTable>
            )}

            {/* Actions */}
            {session.status === 'ONGOING' && (
                <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
                    <button
                        onClick={() => cancelMutation.mutate()}
                        disabled={cancelMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                        <Ban className="h-4 w-4" /> Batalkan Sesi
                    </button>
                    <button
                        onClick={() => finishMutation.mutate()}
                        disabled={finishMutation.isPending || variantMap.size === 0}
                        className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        {finishMutation.isPending ? 'Menyimpan...' : 'Selesaikan & Perbarui Stok'}
                    </button>
                    {finishMutation.isError && (
                        <p className="text-sm text-destructive self-center">{(finishMutation.error as any)?.message}</p>
                    )}
                </div>
            )}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OpnamePage() {
    const [showStart, setShowStart] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const { data: sessions = [], isLoading } = useQuery({
        queryKey: ['opname-sessions'],
        queryFn: getOpnameSessions,
    });

    if (selectedId) {
        return (
            <SessionDetail sessionId={selectedId} onBack={() => setSelectedId(null)} />
        );
    }

    return (
        <div>
            <PageHeader
                title="Stok Opname"
                description="Hitung fisik stok gudang dengan link operator untuk karyawan."
                icon={ClipboardList}
                breadcrumbs={[
                    { label: 'Inventori', href: '/inventory' },
                    { label: 'Stok Opname' },
                ]}
                actions={
                    <button
                        onClick={() => setShowStart(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" /> Mulai Opname
                    </button>
                }
            />

            {/* List Sesi */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : sessions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card">
                    <EmptyState
                        icon={ClipboardList}
                        title="Belum ada sesi opname"
                        description='Klik "Mulai Opname" untuk membuat link operator pertama.'
                        action={
                            <button
                                onClick={() => setShowStart(true)}
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                            >
                                <Plus className="h-4 w-4" /> Mulai Opname
                            </button>
                        }
                    />
                </div>
            ) : (
                <div className="space-y-3">
                    {sessions.map((s: any) => (
                        <div
                            key={s.id}
                            onClick={() => setSelectedId(s.id)}
                            className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/30 cursor-pointer transition-all"
                        >
                            <div className="shrink-0">
                                {s.status === 'ONGOING' && <Clock className="h-5 w-5 text-emerald-500" />}
                                {s.status === 'COMPLETED' && <CheckCircle2 className="h-5 w-5 text-blue-500" />}
                                {s.status === 'CANCELLED' && <Ban className="h-5 w-5 text-muted-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{s.notes || 'Stok Opname'}</span>
                                    <StatusBadge status={s.status} />
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {s.category?.name ? `Kategori: ${s.category.name}` : 'Semua Produk'} ·
                                    {new Date(s.startDate).toLocaleString('id-ID')} ·
                                    {s._count.items} input
                                </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                    ))}
                </div>
            )}

            {showStart && (
                <StartModal
                    onClose={() => setShowStart(false)}
                    onCreated={(id) => { setShowStart(false); setSelectedId(id); }}
                />
            )}
        </div>
    );
}
