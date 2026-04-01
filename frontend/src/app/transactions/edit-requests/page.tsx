"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTransactionEditRequests, reviewTransactionEditRequest, TransactionEditRequest } from '@/lib/api/transactions';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Check, X, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';

dayjs.locale('id');

const STATUS_CONFIG = {
    PENDING: { label: 'Menunggu', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20', icon: Clock },
    APPROVED: { label: 'Disetujui', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle },
    REJECTED: { label: 'Ditolak', color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/20', icon: XCircle },
};

function EditDiff({ request }: { request: TransactionEditRequest }) {
    const { editData, transaction } = request;
    const currentItems: any[] = transaction.items || [];

    return (
        <div className="mt-3 space-y-1.5">
            {(editData.items || []).map((editItem: any) => {
                const current = currentItems.find((i: any) => i.id === editItem.id);
                if (!current) return null;

                const productName = current.productVariant?.product?.name || `Item #${editItem.id}`;
                const variantName = current.productVariant?.variantName;
                const label = variantName ? `${productName} — ${variantName}` : productName;

                const isAreaBased = current.widthCm !== null;

                return (
                    <div key={editItem.id} className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-foreground">{label}:</span>
                        {isAreaBased ? (
                            <>
                                <span className="line-through">{Number(current.widthCm).toFixed(2)} × {Number(current.heightCm).toFixed(2)}</span>
                                <span className="text-foreground font-medium">→</span>
                                <span className="text-emerald-600 font-medium">{editItem.widthCm} × {editItem.heightCm} {editItem.unitType || 'm'}</span>
                            </>
                        ) : (
                            <>
                                <span className="line-through">Qty {current.quantity}</span>
                                <span className="text-foreground font-medium">→</span>
                                <span className="text-emerald-600 font-medium">Qty {editItem.quantity}</span>
                            </>
                        )}
                    </div>
                );
            })}
            {editData.discount !== undefined && editData.discount !== null && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="font-medium text-foreground">Diskon:</span>
                    <span className="line-through">Rp {Number(request.transaction.grandTotal).toLocaleString('id-ID')}</span>
                    <span className="text-foreground font-medium">→</span>
                    <span className="text-emerald-600 font-medium">Rp {Number(editData.discount).toLocaleString('id-ID')}</span>
                </div>
            )}
        </div>
    );
}

function RequestCard({ request, onRefresh }: { request: TransactionEditRequest; onRefresh: () => void }) {
    const queryClient = useQueryClient();
    const [expanded, setExpanded] = useState(false);
    const [reviewing, setReviewing] = useState<'approve' | 'reject' | null>(null);
    const [reviewNote, setReviewNote] = useState('');

    const statusCfg = STATUS_CONFIG[request.status];
    const StatusIcon = statusCfg.icon;

    const reviewMutation = useMutation({
        mutationFn: (params: { approved: boolean; reviewNote?: string }) =>
            reviewTransactionEditRequest(request.id, params),
        onSuccess: () => {
            setReviewing(null);
            setReviewNote('');
            queryClient.invalidateQueries({ queryKey: ['transaction-edit-requests'] });
        },
    });

    const handleReview = (approved: boolean) => {
        if (!approved && !reviewNote.trim()) {
            alert('Harap isi alasan penolakan');
            return;
        }
        reviewMutation.mutate({ approved, reviewNote: reviewNote.trim() || undefined });
    };

    return (
        <div className="bg-background border border-border rounded-xl overflow-hidden">
            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground">{request.transaction.invoiceNumber}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusCfg.bg} ${statusCfg.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusCfg.label}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Diajukan oleh <span className="font-medium text-foreground">{request.requestedBy.name || request.requestedBy.email}</span>
                            {' · '}
                            {dayjs(request.createdAt).format('D MMM YYYY HH:mm')}
                        </p>
                    </div>
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
                    >
                        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                </div>

                {/* Reason */}
                <div className="mt-2 p-2.5 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground"><span className="font-medium">Alasan:</span> {request.reason}</p>
                </div>

                {/* Proposed changes diff */}
                {expanded && <EditDiff request={request} />}
            </div>

            {/* Review note if processed */}
            {request.status !== 'PENDING' && request.reviewNote && (
                <div className="px-4 pb-3">
                    <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Catatan reviewer:</span> {request.reviewNote}
                    </p>
                    {request.reviewedBy && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                            — {request.reviewedBy.name || request.reviewedBy.email}
                        </p>
                    )}
                </div>
            )}

            {/* Action buttons for PENDING */}
            {request.status === 'PENDING' && (
                <div className="px-4 pb-4">
                    {reviewing === null ? (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setReviewing('approve')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                            >
                                <Check className="w-3.5 h-3.5" /> Setujui
                            </button>
                            <button
                                onClick={() => setReviewing('reject')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" /> Tolak
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <textarea
                                value={reviewNote}
                                onChange={(e) => setReviewNote(e.target.value)}
                                rows={2}
                                placeholder={reviewing === 'approve' ? 'Catatan (opsional)...' : 'Alasan penolakan (wajib)...'}
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleReview(reviewing === 'approve')}
                                    disabled={reviewMutation.isPending}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${reviewing === 'approve'
                                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/20'
                                        : 'bg-red-500/10 border border-red-500/20 text-red-600 hover:bg-red-500/20'
                                        }`}
                                >
                                    {reviewMutation.isPending ? 'Memproses...' : reviewing === 'approve' ? 'Konfirmasi Setujui' : 'Konfirmasi Tolak'}
                                </button>
                                <button
                                    onClick={() => { setReviewing(null); setReviewNote(''); }}
                                    className="px-3 py-1.5 bg-muted border border-border rounded-lg text-xs font-medium hover:bg-muted/80 transition-colors"
                                >
                                    Batal
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function EditRequestsPage() {
    const { isManager, currentUser } = useCurrentUser();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

    const { data: pendingRequests, isLoading: isLoadingPending } = useQuery({
        queryKey: ['transaction-edit-requests', 'PENDING'],
        queryFn: () => getTransactionEditRequests('PENDING'),
        enabled: isManager,
        staleTime: 30_000,
    });

    const { data: allRequests, isLoading: isLoadingAll } = useQuery({
        queryKey: ['transaction-edit-requests', 'all'],
        queryFn: () => getTransactionEditRequests(),
        enabled: isManager && activeTab === 'history',
        staleTime: 30_000,
    });

    if (!currentUser) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground text-sm">Memuat...</p>
            </div>
        );
    }

    if (!isManager) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <XCircle className="w-10 h-10 text-red-500/50" />
                <p className="text-foreground font-medium">Akses Ditolak</p>
                <p className="text-muted-foreground text-sm text-center">Halaman ini hanya dapat diakses oleh Admin atau Owner.</p>
            </div>
        );
    }

    const pendingCount = pendingRequests?.length ?? 0;
    const displayRequests = activeTab === 'pending' ? pendingRequests : allRequests;
    const isLoading = activeTab === 'pending' ? isLoadingPending : isLoadingAll;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-foreground">Permintaan Edit Transaksi</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Review dan setujui permintaan perubahan transaksi dari kasir
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'pending'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Menunggu
                    {pendingCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                            {pendingCount > 9 ? '9+' : pendingCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'history'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Riwayat
                </button>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-background border border-border rounded-xl p-4 animate-pulse">
                            <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                            <div className="h-3 bg-muted rounded w-2/3" />
                        </div>
                    ))}
                </div>
            ) : !displayRequests?.length ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 bg-background border border-border rounded-xl">
                    <CheckCircle className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm">
                        {activeTab === 'pending' ? 'Tidak ada permintaan yang menunggu' : 'Belum ada riwayat permintaan'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {displayRequests.map((request) => (
                        <RequestCard
                            key={request.id}
                            request={request}
                            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['transaction-edit-requests'] })}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
