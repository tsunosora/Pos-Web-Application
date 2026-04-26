"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getTransactionById } from "@/lib/api";
import {
    ArrowLeft, Loader2, User, Phone, MapPin, Calendar,
    CreditCard, Hash, Package, Printer, CheckCircle, Clock, AlertCircle,
} from "lucide-react";
import dayjs from "dayjs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TransactionItem {
    id: number;
    quantity: number;
    priceAtTime: number;
    hppAtTime: number;
    widthCm: number | null;
    heightCm: number | null;
    areaCm2: number | null;
    pcs: number | null;
    unitType: string | null;
    note: string | null;
    clickType: string | null;
    productVariant: {
        id: number;
        name: string;
        sku: string | null;
        product: { id: number; name: string; pricingMode: string };
    };
}

interface Transaction {
    id: number;
    invoiceNumber: string;
    checkoutNumber: string | null;
    totalAmount: number;
    tax: number;
    discount: number;
    shippingCost: number;
    grandTotal: number;
    paymentMethod: string;
    status: string;
    customerName: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    dueDate: string | null;
    downPayment: number;
    cashierName: string | null;
    employeeName: string | null;
    createdAt: string;
    items: TransactionItem[];
    printJobs?: PrintJobMini[];
    branchId?: number | null;
    productionBranchId?: number | null;
    branch?: { id: number; name: string; code: string | null } | null;
    productionBranch?: { id: number; name: string; code: string | null } | null;
}

interface PrintJobMini {
    id: number;
    jobNumber: string;
    status: 'ANTRIAN' | 'PROSES' | 'SELESAI' | 'DIAMBIL';
    quantity: number;
    transactionItemId: number;
    startedAt: string | null;
    finishedAt: string | null;
    pickedUpAt: string | null;
    operatorName: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    PAID:    { label: "Lunas",         color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
    PARTIAL: { label: "DP / Sebagian", color: "bg-amber-100 text-amber-700",    icon: Clock },
    PENDING: { label: "Belum Bayar",   color: "bg-gray-100 text-gray-600",      icon: Clock },
    FAILED:  { label: "Dibatalkan",    color: "bg-red-100 text-red-700",         icon: AlertCircle },
};

const PAYMENT_LABELS: Record<string, string> = {
    CASH: "Tunai", TRANSFER: "Transfer Bank", QRIS: "QRIS",
};

// ─── Receipt (print-only) ────────────────────────────────────────────────────

function Receipt({ trx }: { trx: Transaction }) {
    const subtotal  = Number(trx.totalAmount);
    const discount  = Number(trx.discount);
    const shipping  = Number(trx.shippingCost);
    const tax       = Number(trx.tax);
    const grandTotal = Number(trx.grandTotal);
    const dp        = Number(trx.downPayment);
    const remaining = grandTotal - dp;

    return (
        <div id="receipt" className="hidden print:block font-mono text-[11px] w-[72mm] mx-auto leading-snug">
            {/* Store header */}
            <div className="text-center mb-2">
                <p className="font-bold text-[14px] tracking-wide">VOLIKO IMOGIRI</p>
                <p className="text-[10px]">Digital Print & Percetakan</p>
                <p className="text-[10px]">Imogiri, Bantul, Yogyakarta</p>
            </div>

            <div className="border-t border-dashed border-black my-1" />

            {/* Invoice + SC + date */}
            <div className="flex justify-between">
                <span>No. Invoice:</span>
                <span className="font-bold">{trx.invoiceNumber}</span>
            </div>
            {trx.checkoutNumber && (
                <div className="flex justify-between">
                    <span>No. SC:</span>
                    <span className="font-bold">{trx.checkoutNumber}</span>
                </div>
            )}
            <div className="flex justify-between">
                <span>Tgl:</span>
                <span>{dayjs(trx.createdAt).format("DD/MM/YYYY HH:mm")}</span>
            </div>
            {trx.cashierName && (
                <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span>{trx.cashierName}</span>
                </div>
            )}
            {trx.customerName && (
                <div className="flex justify-between">
                    <span>Pelanggan:</span>
                    <span className="text-right max-w-[44mm] truncate">{trx.customerName}</span>
                </div>
            )}
            {trx.customerPhone && (
                <div className="flex justify-between">
                    <span>HP:</span>
                    <span>{trx.customerPhone}</span>
                </div>
            )}

            <div className="border-t border-dashed border-black my-1" />

            {/* Items */}
            {trx.items.map((item, idx) => {
                const isArea = item.productVariant.product.pricingMode === "AREA_BASED";
                const lineTotal = Number(item.priceAtTime) * item.quantity;
                const productName = item.productVariant.product.name;
                const variantName = item.productVariant.name;

                return (
                    <div key={item.id} className={idx > 0 ? "mt-1.5" : ""}>
                        <p className="font-semibold truncate">{productName}</p>
                        {variantName && variantName !== productName && (
                            <p className="text-[10px] text-gray-600 truncate pl-1">{variantName}</p>
                        )}
                        {isArea && item.widthCm && item.heightCm && (
                            <p className="text-[10px] pl-1">
                                {Number(item.widthCm)} × {Number(item.heightCm)} cm
                                {item.pcs && item.pcs > 1 ? ` × ${item.pcs} pcs` : ""}
                            </p>
                        )}
                        {item.note && (
                            <p className="text-[10px] pl-1 italic">"{item.note}"</p>
                        )}
                        <div className="flex justify-between pl-1">
                            <span>
                                {item.quantity} × {formatRp(Number(item.priceAtTime))}
                            </span>
                            <span className="font-semibold">{formatRp(lineTotal)}</span>
                        </div>
                    </div>
                );
            })}

            <div className="border-t border-dashed border-black my-1" />

            {/* Totals */}
            <div className="space-y-0.5">
                <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatRp(subtotal)}</span>
                </div>
                {discount > 0 && (
                    <div className="flex justify-between">
                        <span>Diskon</span>
                        <span>- {formatRp(discount)}</span>
                    </div>
                )}
                {shipping > 0 && (
                    <div className="flex justify-between">
                        <span>Ongkir</span>
                        <span>{formatRp(shipping)}</span>
                    </div>
                )}
                {tax > 0 && (
                    <div className="flex justify-between">
                        <span>Pajak</span>
                        <span>{formatRp(tax)}</span>
                    </div>
                )}
                <div className="flex justify-between font-bold text-[13px] border-t border-black pt-0.5 mt-0.5">
                    <span>TOTAL</span>
                    <span>{formatRp(grandTotal)}</span>
                </div>
                {dp > 0 && (
                    <>
                        <div className="flex justify-between">
                            <span>DP</span>
                            <span>- {formatRp(dp)}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                            <span>SISA</span>
                            <span>{formatRp(remaining)}</span>
                        </div>
                    </>
                )}
                <div className="flex justify-between">
                    <span>Bayar</span>
                    <span>{PAYMENT_LABELS[trx.paymentMethod] ?? trx.paymentMethod}</span>
                </div>
                {trx.status !== "PAID" && trx.dueDate && (
                    <div className="flex justify-between">
                        <span>Jatuh Tempo</span>
                        <span>{dayjs(trx.dueDate).format("DD/MM/YYYY")}</span>
                    </div>
                )}
            </div>

            <div className="border-t border-dashed border-black my-1" />

            {/* Status cap */}
            {trx.status === "PAID" && (
                <div className="my-2 border border-black rounded text-center py-0.5">
                    <p className="font-bold text-[15px] tracking-[0.3em]">★ LUNAS ★</p>
                </div>
            )}
            {trx.status === "PARTIAL" && (
                <div className="my-2 border border-black rounded text-center py-0.5">
                    <p className="font-bold text-[13px] tracking-widest">[ DP / SEBAGIAN ]</p>
                </div>
            )}
            {trx.status === "PENDING" && (
                <div className="my-2 border border-dashed border-black rounded text-center py-0.5">
                    <p className="font-bold text-[13px] tracking-widest">BELUM LUNAS</p>
                </div>
            )}

            <div className="border-t border-dashed border-black my-1" />

            {/* Footer */}
            <p className="text-center text-[10px]">Terima kasih atas kepercayaan Anda!</p>
            <p className="text-center text-[10px]">Barang yang sudah dibeli</p>
            <p className="text-center text-[10px]">tidak dapat dikembalikan.</p>
            <p className="text-center mt-1 text-[10px]">* * *</p>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransactionDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const { data: trx, isLoading, error } = useQuery<Transaction>({
        queryKey: ["transaction", id],
        queryFn: () => getTransactionById(Number(id)),
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (error || !trx) {
        return (
            <div className="space-y-4">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
                    <ArrowLeft className="w-4 h-4" /> Kembali
                </button>
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                    <p className="text-red-700 font-medium">Transaksi tidak ditemukan</p>
                </div>
            </div>
        );
    }

    const statusCfg = STATUS_CONFIG[trx.status] ?? { label: trx.status, color: "bg-gray-100 text-gray-600", icon: AlertCircle };
    const StatusIcon = statusCfg.icon;
    const subtotal   = Number(trx.totalAmount);
    const discount   = Number(trx.discount);
    const shipping   = Number(trx.shippingCost);
    const tax        = Number(trx.tax);
    const grandTotal = Number(trx.grandTotal);
    const dp         = Number(trx.downPayment);
    const remaining  = grandTotal - dp;

    return (
        <>
            {/* ── Print receipt (hidden on screen, visible on print) ── */}
            <Receipt trx={trx} />

            {/* ── Screen view (hidden on print) ── */}
            <div className="print:hidden space-y-6 max-w-4xl">
                {/* Back + Header */}
                <div>
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" /> Kembali
                    </button>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 font-mono">{trx.invoiceNumber}</h1>
                            {trx.checkoutNumber && (
                                <p className="text-sm font-mono text-indigo-600 font-semibold mt-0.5">{trx.checkoutNumber}</p>
                            )}
                            {trx.productionBranchId != null && trx.productionBranchId !== trx.branchId && (
                                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 text-amber-700 border border-amber-500/30 rounded-full text-xs font-bold"
                                    title={`Titipan cetak: dari ${trx.branch?.name || '-'} → dikerjakan di ${trx.productionBranch?.name || '-'}`}>
                                    ⚑ Titipan Cetak — {trx.branch?.name || '?'} → {trx.productionBranch?.name || '?'}
                                </div>
                            )}
                            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                {dayjs(trx.createdAt).format("dddd, DD MMMM YYYY · HH:mm")}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${statusCfg.color}`}>
                                <StatusIcon className="w-4 h-4" />
                                {statusCfg.label}
                            </span>
                            <button
                                onClick={() => window.print()}
                                className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors"
                            >
                                <Printer className="w-4 h-4" />
                                Cetak Struk
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Items table */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                                <Package className="w-4 h-4 text-gray-500" />
                                <p className="font-semibold text-gray-800">Item Pesanan</p>
                                <span className="ml-auto text-xs text-gray-400">{trx.items.length} item</span>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Produk</th>
                                        <th className="text-right px-4 py-3 text-gray-600 font-medium">Qty</th>
                                        <th className="text-right px-4 py-3 text-gray-600 font-medium">Harga</th>
                                        <th className="text-right px-4 py-3 text-gray-600 font-medium">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {trx.items.map(item => {
                                        const isArea = item.productVariant.product.pricingMode === "AREA_BASED";
                                        const lineTotal = Number(item.priceAtTime) * item.quantity;
                                        return (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-gray-800">{item.productVariant.product.name}</p>
                                                    <p className="text-xs text-gray-500">{item.productVariant.name}</p>
                                                    {isArea && item.widthCm && item.heightCm && (
                                                        <p className="text-xs text-indigo-600">
                                                            {Number(item.widthCm).toLocaleString("id-ID")} × {Number(item.heightCm).toLocaleString("id-ID")} cm
                                                            {item.pcs && item.pcs > 1 ? ` × ${item.pcs} pcs` : ""}
                                                        </p>
                                                    )}
                                                    {item.clickType && (
                                                        <p className="text-xs text-purple-600 flex items-center gap-1">
                                                            <Printer className="w-3 h-3" /> {item.clickType}
                                                        </p>
                                                    )}
                                                    {item.note && (
                                                        <p className="text-xs text-gray-400 italic">"{item.note}"</p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-700">
                                                    {item.quantity}
                                                    {item.unitType && (
                                                        <span className="text-xs text-gray-400 ml-1">{item.unitType}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-600">
                                                    {formatRp(Number(item.priceAtTime))}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-gray-800">
                                                    {formatRp(lineTotal)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right: Info cards */}
                    <div className="space-y-4">
                        {/* Customer info */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                            <p className="font-semibold text-gray-800 text-sm">Info Pelanggan</p>
                            {trx.customerName ? (
                                <>
                                    <div className="flex items-start gap-2 text-sm">
                                        <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                                        <span className="text-gray-800 font-medium">{trx.customerName}</span>
                                    </div>
                                    {trx.customerPhone && (
                                        <div className="flex items-start gap-2 text-sm">
                                            <Phone className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                                            <span className="text-gray-600">{trx.customerPhone}</span>
                                        </div>
                                    )}
                                    {trx.customerAddress && (
                                        <div className="flex items-start gap-2 text-sm">
                                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                                            <span className="text-gray-600">{trx.customerAddress}</span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm text-gray-400 italic">Pelanggan umum</p>
                            )}
                        </div>

                        {/* Print Queue status */}
                        {trx.printJobs && trx.printJobs.length > 0 && (
                            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Printer className="w-4 h-4 text-gray-500" />
                                    <p className="font-semibold text-gray-800 text-sm">Status Cetak Paper</p>
                                </div>
                                {trx.printJobs.map(pj => {
                                    const item = trx.items.find(i => i.id === pj.transactionItemId);
                                    const statusMap: Record<string, string> = {
                                        ANTRIAN: 'bg-gray-100 text-gray-700 border-gray-300',
                                        PROSES: 'bg-indigo-100 text-indigo-800 border-indigo-300',
                                        SELESAI: 'bg-green-100 text-green-800 border-green-300',
                                        DIAMBIL: 'bg-sky-100 text-sky-800 border-sky-300',
                                    };
                                    const lastTs = pj.pickedUpAt || pj.finishedAt || pj.startedAt;
                                    return (
                                        <div key={pj.id} className="text-xs border-t first:border-t-0 pt-2 first:pt-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-mono text-[11px] text-indigo-700 font-bold">{pj.jobNumber}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusMap[pj.status]}`}>{pj.status}</span>
                                            </div>
                                            <p className="text-gray-700 mt-0.5">{item?.productVariant.product.name || '—'} · Qty {pj.quantity}</p>
                                            {lastTs && (
                                                <p className="text-[10px] text-gray-500 mt-0.5">
                                                    {dayjs(lastTs).format("DD MMM HH:mm")}{pj.operatorName ? ` · ${pj.operatorName}` : ''}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Payment info */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                            <p className="font-semibold text-gray-800 text-sm">Pembayaran</p>
                            <div className="flex items-center gap-2 text-sm">
                                <CreditCard className="w-4 h-4 text-gray-400 shrink-0" />
                                <span className="text-gray-700">{PAYMENT_LABELS[trx.paymentMethod] ?? trx.paymentMethod}</span>
                            </div>
                            {trx.cashierName && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Hash className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span className="text-gray-600">Kasir: {trx.cashierName}</span>
                                </div>
                            )}
                            {trx.dueDate && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span className="text-gray-600">Jatuh tempo: {dayjs(trx.dueDate).format("DD MMM YYYY")}</span>
                                </div>
                            )}

                            {/* Totals */}
                            <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
                                <div className="flex justify-between text-gray-600">
                                    <span>Subtotal</span>
                                    <span>{formatRp(subtotal)}</span>
                                </div>
                                {discount > 0 && (
                                    <div className="flex justify-between text-red-600">
                                        <span>Diskon</span>
                                        <span>− {formatRp(discount)}</span>
                                    </div>
                                )}
                                {shipping > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>Ongkir</span>
                                        <span>{formatRp(shipping)}</span>
                                    </div>
                                )}
                                {tax > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>Pajak</span>
                                        <span>{formatRp(tax)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 text-base">
                                    <span>Grand Total</span>
                                    <span>{formatRp(grandTotal)}</span>
                                </div>
                                {dp > 0 && (
                                    <>
                                        <div className="flex justify-between text-emerald-600">
                                            <span>DP Diterima</span>
                                            <span>− {formatRp(dp)}</span>
                                        </div>
                                        <div className={`flex justify-between font-semibold ${remaining > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                                            <span>Sisa</span>
                                            <span>{formatRp(remaining)}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
