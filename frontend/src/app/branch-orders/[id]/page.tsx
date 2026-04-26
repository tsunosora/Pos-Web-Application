'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft, CheckCircle2, Circle, Upload, Trash2,
    ClipboardList, Clock, AlertCircle, XCircle, Image,
} from 'lucide-react';
import Link from 'next/link';
import {
    getBranchWorkOrder,
    updateBranchWOStatus,
    toggleBranchWOItem,
    uploadBranchWOProof,
    type BranchWOStatus,
    type BranchWorkOrder,
} from '@/lib/api/branch-work-orders';

const STATUS_LABELS: Record<BranchWOStatus, string> = {
    ANTRIAN: 'Antrian',
    PROSES: 'Proses',
    SELESAI: 'Selesai',
    DIBATALKAN: 'Dibatalkan',
};

const STATUS_COLORS: Record<BranchWOStatus, string> = {
    ANTRIAN: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    PROSES: 'bg-blue-100 text-blue-800 border-blue-200',
    SELESAI: 'bg-green-100 text-green-800 border-green-200',
    DIBATALKAN: 'bg-gray-100 text-gray-600 border-gray-200',
};

function formatDate(s: string) {
    return new Date(s).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDims(item: BranchWorkOrder['items'][0]) {
    const parts: string[] = [];
    if (item.widthCm && item.heightCm) {
        parts.push(`${item.widthCm}×${item.heightCm} cm`);
    }
    if (item.pcs) parts.push(`${item.pcs} lembar`);
    if (item.unitType && item.widthCm && item.heightCm) {
        const m2 = (item.widthCm / 100) * (item.heightCm / 100);
        parts.push(`(${m2.toFixed(2)} m²)`);
    }
    return parts.join(' · ') || null;
}

export default function BranchOrderDetailPage() {
    const params = useParams();
    const id = Number(params.id);
    const qc = useQueryClient();

    const [cancelModal, setCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [statusError, setStatusError] = useState('');
    const [uploadError, setUploadError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const { data: wo, isLoading } = useQuery({
        queryKey: ['branch-work-order', id],
        queryFn: () => getBranchWorkOrder(id),
        enabled: !!id,
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ['branch-work-order', id] });

    const statusMut = useMutation({
        mutationFn: ({ status, reason }: { status: BranchWOStatus; reason?: string }) =>
            updateBranchWOStatus(id, status, reason),
        onSuccess: () => { invalidate(); setCancelModal(false); setCancelReason(''); setStatusError(''); },
        onError: (e: any) => setStatusError(e?.response?.data?.message || 'Gagal ubah status'),
    });

    const toggleMut = useMutation({
        mutationFn: (itemId: number) => toggleBranchWOItem(id, itemId),
        onSuccess: () => invalidate(),
    });

    const uploadMut = useMutation({
        mutationFn: (file: File) => uploadBranchWOProof(id, file),
        onSuccess: () => { invalidate(); setUploadError(''); },
        onError: (e: any) => setUploadError(e?.response?.data?.message || 'Upload gagal'),
    });

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) uploadMut.mutate(file);
        e.target.value = '';
    }

    if (isLoading) return <p className="text-gray-400 text-sm p-6">Memuat...</p>;
    if (!wo) return <p className="text-red-500 text-sm p-6">Work order tidak ditemukan.</p>;

    const doneCount = wo.items.filter(i => i.isDone).length;
    const progressPct = wo.items.length > 0 ? Math.round((doneCount / wo.items.length) * 100) : 0;
    const canProcess = wo.status === 'ANTRIAN';
    const canComplete = wo.status === 'PROSES';
    const canCancel = wo.status === 'ANTRIAN' || wo.status === 'PROSES';
    const canBackToQueue = wo.status === 'PROSES';
    const isDone = wo.status === 'SELESAI';
    const isCancelled = wo.status === 'DIBATALKAN';

    const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

    return (
        <div className="max-w-2xl mx-auto space-y-5">
            {/* Back */}
            <div className="flex items-center gap-2">
                <Link href="/branch-orders" className="text-gray-400 hover:text-gray-600">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <span className="text-gray-500 text-sm">Order Cabang</span>
                <span className="text-gray-300">/</span>
                <span className="font-mono text-sm text-gray-700">{wo.woNumber}</span>
            </div>

            {/* Header Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-gray-800 font-mono">{wo.woNumber}</h1>
                        <p className="text-blue-600 font-medium">{wo.branch.name}</p>
                        {wo.branch.phone && <p className="text-xs text-gray-400">{wo.branch.phone}</p>}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${STATUS_COLORS[wo.status]}`}>
                        {wo.status === 'ANTRIAN' && <Clock className="w-3.5 h-3.5" />}
                        {wo.status === 'PROSES' && <AlertCircle className="w-3.5 h-3.5" />}
                        {wo.status === 'SELESAI' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {wo.status === 'DIBATALKAN' && <XCircle className="w-3.5 h-3.5" />}
                        {STATUS_LABELS[wo.status]}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    {wo.referenceNumber && (
                        <div>
                            <span className="text-gray-400 text-xs">Ref / Nota</span>
                            <p className="text-gray-700 font-medium">{wo.referenceNumber}</p>
                        </div>
                    )}
                    {wo.receivedBy && (
                        <div>
                            <span className="text-gray-400 text-xs">Diterima oleh</span>
                            <p className="text-gray-700">{wo.receivedBy}</p>
                        </div>
                    )}
                    <div>
                        <span className="text-gray-400 text-xs">Tanggal Masuk</span>
                        <p className="text-gray-700">{formatDate(wo.createdAt)}</p>
                    </div>
                    {wo.completedAt && (
                        <div>
                            <span className="text-gray-400 text-xs">Selesai</span>
                            <p className="text-green-700">{formatDate(wo.completedAt)}</p>
                        </div>
                    )}
                </div>

                {wo.notes && (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm text-amber-800">
                        <span className="font-medium">Catatan:</span> {wo.notes}
                    </div>
                )}

                {wo.cancelReason && (
                    <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm text-red-700">
                        <span className="font-medium">Alasan dibatalkan:</span> {wo.cancelReason}
                    </div>
                )}
            </div>

            {/* Proof Photo */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                        <Image className="w-4 h-4 text-gray-400" />
                        Foto Nota / Bukti Order
                    </h2>
                    {!isDone && !isCancelled && (
                        <button
                            onClick={() => fileRef.current?.click()}
                            disabled={uploadMut.isPending}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                            <Upload className="w-4 h-4" />
                            {uploadMut.isPending ? 'Mengupload...' : wo.proofFilename ? 'Ganti Foto' : 'Upload Foto'}
                        </button>
                    )}
                    <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
                {uploadError && <p className="text-red-600 text-xs">{uploadError}</p>}
                {wo.proofFilename ? (
                    <a href={`${backendUrl}${wo.proofFilename}`} target="_blank" rel="noopener noreferrer">
                        <img
                            src={`${backendUrl}${wo.proofFilename}`}
                            alt="Bukti nota"
                            className="max-h-72 rounded-lg border border-gray-200 object-contain w-full"
                        />
                    </a>
                ) : (
                    <div className="text-center py-8 text-gray-300">
                        <Image className="w-10 h-10 mx-auto mb-1" />
                        <p className="text-sm">Belum ada foto nota</p>
                    </div>
                )}
            </div>

            {/* Items */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-gray-400" />
                        Items ({doneCount}/{wo.items.length} selesai)
                    </h2>
                    {wo.items.length > 0 && (
                        <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 rounded-full transition-all"
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                            <span className="text-xs text-gray-500">{progressPct}%</span>
                        </div>
                    )}
                </div>

                {wo.items.map(item => {
                    const dims = formatDims(item);
                    return (
                        <div
                            key={item.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${item.isDone ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}
                        >
                            <button
                                onClick={() => wo.status === 'PROSES' && toggleMut.mutate(item.id)}
                                disabled={wo.status !== 'PROSES' || toggleMut.isPending}
                                className={`mt-0.5 shrink-0 ${wo.status === 'PROSES' ? 'cursor-pointer' : 'cursor-default opacity-50'}`}
                                title={wo.status === 'PROSES' ? (item.isDone ? 'Tandai belum selesai' : 'Tandai selesai') : 'Ubah status WO ke PROSES dulu'}
                            >
                                {item.isDone
                                    ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    : <Circle className="w-5 h-5 text-gray-300" />
                                }
                            </button>
                            <div className="flex-1 min-w-0">
                                <p className={`font-medium text-sm ${item.isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                    {item.productVariant.product.name} — {item.productVariant.name}
                                </p>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                    <span className="text-xs text-gray-500">Qty: {item.quantity}</span>
                                    {dims && <span className="text-xs text-gray-500">{dims}</span>}
                                </div>
                                {item.note && (
                                    <p className="text-xs text-amber-700 mt-1 italic">{item.note}</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Actions */}
            {!isDone && !isCancelled && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                    <h2 className="font-semibold text-gray-700">Aksi</h2>
                    {statusError && <p className="text-red-600 text-sm">{statusError}</p>}
                    <div className="flex flex-wrap gap-2">
                        {canProcess && (
                            <button
                                onClick={() => statusMut.mutate({ status: 'PROSES' })}
                                disabled={statusMut.isPending}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                            >
                                Mulai Proses
                            </button>
                        )}
                        {canComplete && (
                            <button
                                onClick={() => statusMut.mutate({ status: 'SELESAI' })}
                                disabled={statusMut.isPending}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                            >
                                Tandai Selesai
                            </button>
                        )}
                        {canBackToQueue && (
                            <button
                                onClick={() => statusMut.mutate({ status: 'ANTRIAN' })}
                                disabled={statusMut.isPending}
                                className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                            >
                                Kembalikan ke Antrian
                            </button>
                        )}
                        {canCancel && (
                            <button
                                onClick={() => { setCancelModal(true); setStatusError(''); }}
                                className="border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-50"
                            >
                                Batalkan
                            </button>
                        )}
                    </div>
                    {canComplete && doneCount < wo.items.length && (
                        <p className="text-xs text-amber-600">
                            Masih ada {wo.items.length - doneCount} item belum selesai. Kamu tetap bisa tandai WO sebagai selesai.
                        </p>
                    )}
                </div>
            )}

            {/* Cancel Modal */}
            {cancelModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
                        <h3 className="font-semibold text-gray-800">Batalkan Work Order?</h3>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Alasan Pembatalan *</label>
                            <textarea
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                rows={3}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                placeholder="Tuliskan alasan pembatalan..."
                            />
                        </div>
                        {statusError && <p className="text-red-600 text-sm">{statusError}</p>}
                        <div className="flex gap-2">
                            <button
                                onClick={() => statusMut.mutate({ status: 'DIBATALKAN', reason: cancelReason })}
                                disabled={statusMut.isPending || !cancelReason.trim()}
                                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                            >
                                {statusMut.isPending ? 'Membatalkan...' : 'Batalkan WO'}
                            </button>
                            <button
                                onClick={() => { setCancelModal(false); setStatusError(''); }}
                                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
