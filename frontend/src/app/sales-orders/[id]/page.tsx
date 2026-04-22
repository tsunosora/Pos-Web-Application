"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft, Send, FileText, XCircle, Upload, Trash2, Loader2,
    User, Phone, MapPin, Calendar, Edit3, ExternalLink, CheckCircle2
} from "lucide-react";
import {
    getSalesOrder, sendSOWhatsapp, cancelSO, uploadProofs, deleteProof,
    type SalesOrder, type SalesOrderStatus
} from "@/lib/api/sales-orders";
import dayjs from "dayjs";
import "dayjs/locale/id";

dayjs.locale("id");

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// proof.filename is stored as "public/uploads/so-proofs/xxx" — convert to URL
function proofUrl(filename: string): string {
    const rel = filename.replace(/^public[\\/]/i, '/').replace(/\\/g, '/');
    return `${API_URL}${rel.startsWith('/') ? rel : '/' + rel}`;
}

const STATUS_BADGE: Record<SalesOrderStatus, string> = {
    DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
    SENT: 'bg-blue-100 text-blue-700 border-blue-200',
    INVOICED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    CANCELLED: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_LABEL: Record<SalesOrderStatus, string> = {
    DRAFT: 'Draft',
    SENT: 'Terkirim ke Group WA',
    INVOICED: 'Sudah Dibuatkan Nota',
    CANCELLED: 'Dibatalkan',
};

export default function SalesOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const id = Number(params?.id);

    const [waMessage, setWaMessage] = useState('');
    const [showCancel, setShowCancel] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const { data: so, isLoading } = useQuery<SalesOrder>({
        queryKey: ['sales-order', id],
        queryFn: () => getSalesOrder(id),
        enabled: !!id,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
        queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
        queryClient.invalidateQueries({ queryKey: ['so-pending-invoice-count'] });
    };

    const sendMut = useMutation({
        mutationFn: () => sendSOWhatsapp(id, waMessage.trim() || undefined),
        onSuccess: () => { invalidate(); setError(null); },
        onError: (e: any) => setError(e?.response?.data?.message || 'Gagal kirim WA'),
    });

    const cancelMut = useMutation({
        mutationFn: () => cancelSO(id, cancelReason.trim()),
        onSuccess: () => { invalidate(); setShowCancel(false); setCancelReason(''); },
        onError: (e: any) => setError(e?.response?.data?.message || 'Gagal batalkan SO'),
    });

    const deleteProofMut = useMutation({
        mutationFn: (proofId: number) => deleteProof(id, proofId),
        onSuccess: invalidate,
    });

    async function handleProofUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploading(true);
        try {
            await uploadProofs(id, Array.from(files));
            invalidate();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Gagal upload proof');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    }

    const totalItems = so?.items?.length ?? 0;

    const estimatedCaption = useMemo(() => {
        if (!so) return '';
        const lines: string[] = [];
        lines.push(`*SURAT ORDER ${so.soNumber}*`);
        lines.push('');
        lines.push(`Pelanggan: ${so.customerName}`);
        if (so.customerPhone) lines.push(`HP: ${so.customerPhone}`);
        lines.push(`Desainer: ${so.designerName}`);
        if (so.deadline) lines.push(`Deadline: ${dayjs(so.deadline).format('DD MMM YYYY HH:mm')}`);
        lines.push('');
        lines.push('*Detail Item:*');
        so.items.forEach((it, i) => {
            const p = it.productVariant?.product?.name ?? 'Produk';
            const v = it.productVariant?.variantName ? ` — ${it.productVariant.variantName}` : '';
            const dim = (it.widthCm && it.heightCm) ? ` [${it.widthCm}×${it.heightCm}${it.unitType || 'cm'}]` : '';
            const pcs = it.pcs && it.pcs > 1 ? ` ×${it.pcs}pcs` : '';
            lines.push(`${i + 1}. ${p}${v}${dim}${pcs} (${it.quantity})${it.note ? `\n   _${it.note}_` : ''}`);
        });
        if (so.notes) {
            lines.push('');
            lines.push(`*Catatan:*\n${so.notes}`);
        }
        return lines.join('\n');
    }, [so]);

    if (isLoading || !so) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
            </div>
        );
    }

    const canEdit = so.status === 'DRAFT' || so.status === 'SENT';
    const canSendWa = so.status === 'DRAFT' || so.status === 'SENT';
    const canInvoice = so.status === 'SENT';
    const canCancel = so.status === 'DRAFT' || so.status === 'SENT';

    return (
        <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center gap-2">
                <Link href="/sales-orders" className="p-2 hover:bg-muted rounded-md">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl font-bold font-mono">{so.soNumber}</h1>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_BADGE[so.status]}`}>
                            {STATUS_LABEL[so.status]}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Dibuat {dayjs(so.createdAt).format('DD MMM YYYY HH:mm')}
                        {so.sentToWaAt && ` • Terakhir dikirim WA ${dayjs(so.sentToWaAt).format('DD MMM HH:mm')}`}
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                    {error}
                </div>
            )}

            {so.status === 'INVOICED' && so.transaction && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <div className="flex-1">
                        SO ini sudah dibuatkan nota: <span className="font-mono font-semibold">{so.transaction.invoiceNumber}</span>
                        {so.transaction.status && ` — ${so.transaction.status}`}
                    </div>
                    <Link href={`/transactions/dp?search=${so.transaction.invoiceNumber}`} className="text-emerald-700 hover:underline text-xs flex items-center gap-1">
                        Lihat <ExternalLink className="h-3 w-3" />
                    </Link>
                </div>
            )}

            {so.status === 'CANCELLED' && so.cancelReason && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm">
                    <span className="font-semibold">Dibatalkan:</span> {so.cancelReason}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left column — customer + items */}
                <div className="lg:col-span-2 space-y-4">
                    <Section title="Customer">
                        <div className="space-y-1.5 text-sm">
                            <Row icon={<User className="h-4 w-4 text-muted-foreground" />}>{so.customerName}</Row>
                            {so.customerPhone && <Row icon={<Phone className="h-4 w-4 text-muted-foreground" />}>{so.customerPhone}</Row>}
                            {so.customerAddress && <Row icon={<MapPin className="h-4 w-4 text-muted-foreground" />}>{so.customerAddress}</Row>}
                            <Row icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                <span className="text-xs text-muted-foreground">Desainer:</span> {so.designerName}
                            </Row>
                            {so.deadline && (
                                <Row icon={<Calendar className="h-4 w-4 text-muted-foreground" />}>
                                    <span className="text-xs text-muted-foreground">Deadline:</span> {dayjs(so.deadline).format('DD MMM YYYY HH:mm')}
                                </Row>
                            )}
                        </div>
                    </Section>

                    <Section title={`Item (${totalItems})`}>
                        <div className="space-y-2">
                            {so.items.map((it, idx) => {
                                const p = it.productVariant?.product?.name ?? 'Produk';
                                const v = it.productVariant?.variantName ? ` — ${it.productVariant.variantName}` : '';
                                return (
                                    <div key={it.id} className="border border-border rounded-md p-2.5 text-sm bg-muted/20">
                                        <div className="flex justify-between gap-2">
                                            <div className="font-medium">{idx + 1}. {p}{v}</div>
                                            <div className="text-xs text-muted-foreground font-mono">SKU: {it.productVariant?.sku}</div>
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                                            <span>Qty: <b className="text-foreground">{it.quantity}</b></span>
                                            {it.widthCm && it.heightCm && (
                                                <span>Dim: <b className="text-foreground">{it.widthCm}×{it.heightCm} {it.unitType || 'cm'}</b></span>
                                            )}
                                            {it.pcs && it.pcs > 1 && <span>Pcs: <b className="text-foreground">{it.pcs}</b></span>}
                                            {it.customPrice && <span>Harga Override: <b className="text-foreground">Rp {Number(it.customPrice).toLocaleString('id-ID')}</b></span>}
                                        </div>
                                        {it.note && <div className="text-xs italic text-muted-foreground mt-1">&ldquo;{it.note}&rdquo;</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </Section>

                    {so.notes && (
                        <Section title="Catatan Order">
                            <p className="text-sm whitespace-pre-wrap">{so.notes}</p>
                        </Section>
                    )}

                    <Section title={`Proof Gambar (${so.proofs?.length ?? 0})`}>
                        {canEdit && (
                            <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-md cursor-pointer hover:bg-muted text-sm mb-3">
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                Tambah Gambar
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={handleProofUpload}
                                    disabled={uploading}
                                    className="hidden"
                                />
                            </label>
                        )}
                        {(so.proofs?.length ?? 0) === 0 ? (
                            <p className="text-xs text-muted-foreground">Belum ada gambar proof.</p>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {so.proofs.map(p => (
                                    <div key={p.id} className="relative group border border-border rounded overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={proofUrl(p.filename)}
                                            alt={p.caption ?? 'proof'}
                                            className="w-full h-32 object-cover"
                                        />
                                        {canEdit && (
                                            <button
                                                onClick={() => deleteProofMut.mutate(p.id)}
                                                className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>
                </div>

                {/* Right column — actions */}
                <div className="space-y-4">
                    {canSendWa && (
                        <Section title="Kirim ke Group WA Internal">
                            <p className="text-xs text-muted-foreground mb-2">
                                Broadcast SO ini + gambar proof ke group WA tim (desain/kasir/operator). Bukan ke customer.
                            </p>
                            <textarea
                                value={waMessage}
                                onChange={e => setWaMessage(e.target.value)}
                                placeholder={`Pesan tambahan (opsional).\n\nCaption auto:\n${estimatedCaption.slice(0, 180)}...`}
                                className="w-full px-3 py-2 text-xs border border-border rounded-md bg-background font-mono"
                                rows={4}
                            />
                            <button
                                onClick={() => sendMut.mutate()}
                                disabled={sendMut.isPending}
                                className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                            >
                                {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                {so.status === 'SENT' ? 'Kirim Ulang ke Group' : 'Kirim ke Group WA'}
                            </button>
                        </Section>
                    )}

                    {canInvoice && (
                        <Section title="Buat Nota / Invoice">
                            <p className="text-xs text-muted-foreground mb-2">
                                Bawa ke halaman kasir dengan item SO ter-prefill. Setelah nota terbit, SO otomatis berstatus INVOICED.
                            </p>
                            <button
                                onClick={() => router.push(`/pos?fromSO=${so.id}`)}
                                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-emerald-700"
                            >
                                <FileText className="h-4 w-4" />
                                Buat Nota di POS
                            </button>
                        </Section>
                    )}

                    {canEdit && (
                        <Section title="Edit SO">
                            <Link
                                href={`/sales-orders/new?edit=${so.id}`}
                                className="w-full inline-flex items-center justify-center gap-2 border border-border px-3 py-2 rounded-md text-sm font-medium hover:bg-muted"
                            >
                                <Edit3 className="h-4 w-4" />
                                Edit (belum tersedia)
                            </Link>
                            <p className="text-[11px] text-muted-foreground mt-2">
                                Fitur edit detail akan ditambahkan pada update berikut.
                            </p>
                        </Section>
                    )}

                    {canCancel && (
                        <Section title="Batalkan SO">
                            {!showCancel ? (
                                <button
                                    onClick={() => setShowCancel(true)}
                                    className="w-full inline-flex items-center justify-center gap-2 border border-red-300 text-red-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-50"
                                >
                                    <XCircle className="h-4 w-4" /> Batalkan SO
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <textarea
                                        value={cancelReason}
                                        onChange={e => setCancelReason(e.target.value)}
                                        placeholder="Alasan pembatalan..."
                                        className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                                        rows={3}
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setShowCancel(false); setCancelReason(''); }}
                                            className="flex-1 px-3 py-1.5 text-sm border border-border rounded hover:bg-muted"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            onClick={() => cancelMut.mutate()}
                                            disabled={!cancelReason.trim() || cancelMut.isPending}
                                            className="flex-1 inline-flex items-center justify-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50"
                                        >
                                            {cancelMut.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                                            Konfirmasi
                                        </button>
                                    </div>
                                </div>
                            )}
                        </Section>
                    )}
                </div>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3">{title}</h2>
            {children}
        </div>
    );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2">
            <div className="mt-0.5">{icon}</div>
            <div className="flex-1">{children}</div>
        </div>
    );
}
