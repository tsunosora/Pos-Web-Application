"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, XCircle, Upload, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { designerGetSO, designerSendWA, designerCancelSO, designerUploadProofs, designerDeleteProof } from "@/lib/api/designers";
import { useDesignerSession } from "../../useDesignerSession";
import type { SalesOrder, SalesOrderStatus } from "@/lib/api/sales-orders";
import dayjs from "dayjs";
import "dayjs/locale/id";

dayjs.locale("id");

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function proofUrl(filename: string) {
    const rel = filename.replace(/^public[\\/]/i, "/").replace(/\\/g, "/");
    return `${API_URL}${rel.startsWith("/") ? rel : "/" + rel}`;
}

const STATUS_BADGE: Record<SalesOrderStatus, string> = {
    DRAFT: "bg-slate-200 text-slate-700 border border-slate-300",
    SENT: "bg-blue-100 text-blue-700 border border-blue-200",
    INVOICED: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    CANCELLED: "bg-red-100 text-red-700 border border-red-200",
};
const STATUS_LABEL: Record<SalesOrderStatus, string> = {
    DRAFT: "Draft",
    SENT: "Terkirim ke Group WA",
    INVOICED: "Sudah Dibuatkan Nota",
    CANCELLED: "Dibatalkan",
};

export default function DesignerSODetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const session = useDesignerSession();

    const [so, setSo] = useState<SalesOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [waMessage, setWaMessage] = useState("");
    const [showCancel, setShowCancel] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [uploading, setUploading] = useState(false);
    const [sending, setSending] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    async function reload() {
        setLoading(true);
        try {
            setSo(await designerGetSO(Number(id)));
        } catch {
            setError("Gagal memuat SO");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { if (id) reload(); }, [id]);

    const caption = useMemo(() => {
        if (!so) return "";
        const lines: string[] = [`*SURAT ORDER ${so.soNumber}*`, ""];
        lines.push(`Pelanggan: ${so.customerName}`);
        if (so.customerPhone) lines.push(`HP: ${so.customerPhone}`);
        if (so.deadline) lines.push(`Deadline: ${dayjs(so.deadline).format("DD MMM YYYY HH:mm")}`);
        lines.push("", "*Detail Item:*");
        so.items.forEach((it, i) => {
            const p = it.productVariant?.product?.name ?? "Produk";
            const v = it.productVariant?.variantName ? ` — ${it.productVariant.variantName}` : "";
            const dim = it.widthCm && it.heightCm ? ` [${it.widthCm}×${it.heightCm}${it.unitType || "cm"}]` : "";
            const pcs = it.pcs && it.pcs > 1 ? ` ×${it.pcs}pcs` : "";
            lines.push(`${i + 1}. ${p}${v}${dim}${pcs} (${it.quantity})${it.note ? `\n   _${it.note}_` : ""}`);
        });
        if (so.notes) lines.push("", `*Catatan:*\n${so.notes}`);
        return lines.join("\n");
    }, [so]);

    async function sendWA() {
        if (!session || !so) return;
        setSending(true); setError(null);
        try {
            await designerSendWA(so.id, session.id, session.pin, waMessage.trim() || undefined);
            await reload();
        } catch (e: any) {
            setError(e?.response?.data?.message || "Gagal kirim ke WA");
        } finally {
            setSending(false);
        }
    }

    async function cancel() {
        if (!session || !so) return;
        setCancelling(true); setError(null);
        try {
            await designerCancelSO(so.id, session.id, session.pin, cancelReason.trim());
            await reload();
            setShowCancel(false); setCancelReason("");
        } catch (e: any) {
            setError(e?.response?.data?.message || "Gagal batalkan SO");
        } finally {
            setCancelling(false);
        }
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!session || !so) return;
        const files = e.target.files;
        if (!files?.length) return;
        setUploading(true);
        try {
            await designerUploadProofs(so.id, session.id, session.pin, Array.from(files));
            await reload();
        } catch (e: any) {
            setError(e?.response?.data?.message || "Gagal upload");
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    }

    async function removeProof(proofId: number) {
        if (!session || !so) return;
        try {
            await designerDeleteProof(so.id, proofId, session.id, session.pin);
            await reload();
        } catch (e: any) {
            setError(e?.response?.data?.message || "Gagal hapus proof");
        }
    }

    if (!session) return null;

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-950">
            <Loader2 className="h-5 w-5 animate-spin" />
        </div>
    );

    if (!so) return (
        <div className="min-h-screen flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm bg-slate-50 dark:bg-slate-950">SO tidak ditemukan</div>
    );

    const canEdit = so.status === "DRAFT" || so.status === "SENT";
    const canSendWa = so.status === "DRAFT" || so.status === "SENT";
    const canCancel = so.status === "DRAFT" || so.status === "SENT";

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 flex items-center gap-3 shadow-lg shadow-indigo-500/20 sticky top-0 z-10">
                <Link href="/so-designer/dashboard" className="p-1.5 hover:bg-white/15 rounded-lg transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm">{so.soNumber}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[so.status]}`}>
                            {STATUS_LABEL[so.status]}
                        </span>
                    </div>
                    <div className="text-xs text-indigo-100 truncate">{so.customerName}</div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-4 space-y-4">
                {error && <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 text-sm">{error}</div>}

                {so.status === "INVOICED" && so.transaction && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3 flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>Nota sudah dibuat: <span className="font-mono font-semibold">{so.transaction.invoiceNumber}</span></div>
                    </div>
                )}

                {/* Customer & info */}
                <Card title="Detail Order">
                    <dl className="text-sm space-y-1">
                        <Row label="Customer">{so.customerName}</Row>
                        {so.customerPhone && <Row label="HP">{so.customerPhone}</Row>}
                        {so.customerAddress && <Row label="Alamat">{so.customerAddress}</Row>}
                        <Row label="Desainer">{so.designerName}</Row>
                        {so.deadline && <Row label="Deadline">{dayjs(so.deadline).format("DD MMM YYYY HH:mm")}</Row>}
                        {so.notes && <Row label="Catatan">{so.notes}</Row>}
                    </dl>
                </Card>

                {/* Items */}
                <Card title={`Item (${so.items.length})`}>
                    <div className="space-y-2">
                        {so.items.map((it, idx) => (
                            <div key={it.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm bg-slate-50 dark:bg-slate-800/50">
                                <div className="font-medium text-slate-800 dark:text-slate-200">{idx + 1}. {it.productVariant?.product?.name}{it.productVariant?.variantName ? ` — ${it.productVariant.variantName}` : ""}</div>
                                <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex flex-wrap gap-x-3">
                                    <span>Qty: <b className="text-slate-700 dark:text-slate-300">{it.quantity}</b></span>
                                    {it.widthCm && it.heightCm && <span>Dim: <b className="text-slate-700 dark:text-slate-300">{it.widthCm}×{it.heightCm}{it.unitType || "cm"}</b></span>}
                                    {it.pcs && it.pcs > 1 && <span>Pcs: <b className="text-slate-700 dark:text-slate-300">{it.pcs}</b></span>}
                                </div>
                                {it.note && <div className="text-xs italic text-slate-400 dark:text-slate-500 mt-0.5">&ldquo;{it.note}&rdquo;</div>}
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Proofs */}
                <Card title={`Gambar Proof (${so.proofs?.length ?? 0})`}>
                    {canEdit && (
                        <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 dark:hover:border-indigo-800 text-sm text-slate-600 dark:text-slate-300 mb-3 transition-colors">
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Tambah Gambar
                            <input type="file" multiple accept="image/*" onChange={handleUpload} disabled={uploading} className="hidden" />
                        </label>
                    )}
                    {(so.proofs?.length ?? 0) === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500">Belum ada gambar proof.</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {so.proofs.map(p => (
                                <div key={p.id} className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={proofUrl(p.filename)} alt="proof" className="w-full h-32 object-cover" />
                                    {canEdit && (
                                        <button onClick={() => removeProof(p.id)}
                                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition">
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Kirim WA */}
                {canSendWa && (
                    <Card title="Kirim ke Group WA Internal">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Broadcast ke group tim (desain/kasir/operator) dengan caption + gambar proof.</p>
                        <textarea value={waMessage} onChange={e => setWaMessage(e.target.value)}
                            placeholder={`Pesan tambahan (opsional)\n\nCaption auto:\n${caption.slice(0, 200)}...`}
                            className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400" rows={4} />
                        <button onClick={sendWA} disabled={sending}
                            className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition">
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            {so.status === "SENT" ? "Kirim Ulang ke Group" : "Kirim ke Group WA"}
                        </button>
                    </Card>
                )}

                {/* Batalkan */}
                {canCancel && (
                    <Card title="Batalkan SO">
                        {!showCancel ? (
                            <button onClick={() => setShowCancel(true)}
                                className="w-full inline-flex items-center justify-center gap-2 border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                                <XCircle className="h-4 w-4" /> Batalkan SO
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                                    placeholder="Alasan pembatalan..."
                                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-400" rows={3} />
                                <div className="flex gap-2">
                                    <button onClick={() => { setShowCancel(false); setCancelReason(""); }}
                                        className="flex-1 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors">Batal</button>
                                    <button onClick={cancel} disabled={!cancelReason.trim() || cancelling}
                                        className="flex-1 inline-flex items-center justify-center gap-1 bg-red-600 text-white py-2 rounded-xl text-sm hover:bg-red-700 disabled:opacity-50 transition-colors">
                                        {cancelling && <Loader2 className="h-3 w-3 animate-spin" />} Konfirmasi
                                    </button>
                                </div>
                            </div>
                        )}
                    </Card>
                )}
            </div>
        </div>
    );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">{title}</h3>
            {children}
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex gap-2">
            <span className="text-slate-400 dark:text-slate-500 w-20 shrink-0">{label}:</span>
            <span className="text-slate-700 dark:text-slate-300">{children}</span>
        </div>
    );
}
