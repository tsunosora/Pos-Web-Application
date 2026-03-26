"use client";

import { useRef } from "react";
import { X, Printer } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/id";
import { Invoice, fmt, STATUS_CONFIG } from "./types";

dayjs.extend(relativeTime);
dayjs.locale("id");

export function PrintModal({ doc, settings, onClose }: { doc: Invoice; settings: any; onClose: () => void }) {
    const printRef = useRef<HTMLDivElement>(null);
    const isQuotation = doc.type === "QUOTATION";
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const logoUrl = settings?.logoImageUrl ? `${API_URL}${settings.logoImageUrl}` : null;

    const subtotal = parseFloat(doc.subtotal);
    const taxAmount = parseFloat(doc.taxAmount);
    const discount = parseFloat(doc.discount);
    const total = parseFloat(doc.total);
    const taxRate = parseFloat(doc.taxRate);

    const handlePrint = () => {
        const content = printRef.current?.innerHTML ?? "";
        const win = window.open("", "_blank", "width=900,height=700");
        if (!win) return;
        win.document.write(`<!DOCTYPE html><html><head><title>${doc.invoiceNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; background: #fff; }
  .page { padding: 32px; max-width: 800px; margin: 0 auto; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f3f4f6; font-size: 10pt; padding: 8px; text-align: left; border: 1px solid #e5e7eb; }
  td { padding: 8px; border: 1px solid #e5e7eb; font-size: 10pt; vertical-align: top; }
  .text-right { text-align: right; }
  @media print { @page { margin: 20mm; } }
</style></head><body><div class="page">${content}</div></body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 500);
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-4xl rounded-xl border border-border shadow-lg flex flex-col max-h-[95vh]">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center shrink-0">
                    <h3 className="font-semibold text-foreground">Preview {isQuotation ? "Penawaran Harga" : "Invoice"}</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                            <Printer className="h-4 w-4" /> Cetak / PDF
                        </button>
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-2"><X className="h-4 w-4" /></button>
                    </div>
                </div>
                <div className="overflow-y-auto grow p-8">
                    <div ref={printRef} className="bg-white text-gray-900 p-8 rounded-lg max-w-2xl mx-auto shadow-sm">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                {logoUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={logoUrl} alt="Logo" className="h-12 w-auto mb-2 object-contain" />
                                )}
                                <p className="text-lg font-bold text-gray-800">{settings?.storeName ?? "Nama Toko"}</p>
                                {settings?.address && <p className="text-sm text-gray-600 mt-0.5">{settings.address}</p>}
                                {settings?.phone && <p className="text-sm text-gray-600">{settings.phone}</p>}
                            </div>
                            <div className="text-right">
                                <h1 className="text-2xl font-bold text-gray-800">{isQuotation ? "PENAWARAN HARGA" : "INVOICE"}</h1>
                                <p className="text-base font-semibold text-blue-700 mt-1">{doc.invoiceNumber}</p>
                                <p className="text-sm text-gray-600 mt-1">Tanggal: {dayjs(doc.date).format("DD MMMM YYYY")}</p>
                                {doc.dueDate && <p className="text-sm text-gray-600">Jatuh Tempo: {dayjs(doc.dueDate).format("DD MMMM YYYY")}</p>}
                                {doc.validUntil && <p className="text-sm text-gray-600">Berlaku s/d: {dayjs(doc.validUntil).format("DD MMMM YYYY")}</p>}
                            </div>
                        </div>

                        {/* Divider */}
                        <hr className="border-gray-200 mb-6" />

                        {/* Client + Status */}
                        <div className="grid grid-cols-2 gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Kepada Yth.</p>
                                <p className="font-bold text-gray-900">{doc.clientName}</p>
                                {doc.clientCompany && <p className="text-sm font-medium text-gray-700">{doc.clientCompany}</p>}
                                {doc.clientAddress && <p className="text-sm text-gray-600 mt-1">{doc.clientAddress}</p>}
                                {doc.clientPhone && <p className="text-sm text-gray-600 mt-0.5">📞 {doc.clientPhone}</p>}
                                {doc.clientEmail && <p className="text-sm text-gray-600">✉ {doc.clientEmail}</p>}
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status</p>
                                <span className="inline-block px-3 py-1 rounded text-sm font-semibold" style={{
                                    background: doc.status === "PAID" || doc.status === "ACCEPTED" ? "#d1fae5" :
                                        doc.status === "SENT" ? "#dbeafe" :
                                        doc.status === "REJECTED" || doc.status === "CANCELLED" ? "#fee2e2" : "#f3f4f6",
                                    color: doc.status === "PAID" || doc.status === "ACCEPTED" ? "#065f46" :
                                        doc.status === "SENT" ? "#1d4ed8" :
                                        doc.status === "REJECTED" || doc.status === "CANCELLED" ? "#991b1b" : "#374151"
                                }}>{STATUS_CONFIG[doc.status].label}</span>
                            </div>
                        </div>

                        {/* Items */}
                        <table className="w-full border-collapse mb-4 text-sm">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-gray-200 p-2 text-left w-8 text-gray-700">No</th>
                                    <th className="border border-gray-200 p-2 text-left text-gray-700">Deskripsi Pekerjaan / Produk</th>
                                    <th className="border border-gray-200 p-2 text-center w-16 text-gray-700">Sat.</th>
                                    <th className="border border-gray-200 p-2 text-center w-16 text-gray-700">Qty</th>
                                    <th className="border border-gray-200 p-2 text-right w-32 text-gray-700">Harga Satuan</th>
                                    <th className="border border-gray-200 p-2 text-right w-32 text-gray-700">Jumlah</th>
                                </tr>
                            </thead>
                            <tbody>
                                {doc.items.map((item, i) => (
                                    <tr key={i} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                                        <td className="border border-gray-200 p-2 text-center text-gray-600">{i + 1}</td>
                                        <td className="border border-gray-200 p-2 text-gray-800">{item.description}</td>
                                        <td className="border border-gray-200 p-2 text-center text-gray-600">{item.unit || "-"}</td>
                                        <td className="border border-gray-200 p-2 text-center text-gray-600">{item.quantity}</td>
                                        <td className="border border-gray-200 p-2 text-right text-gray-700">{fmt(Number(item.price))}</td>
                                        <td className="border border-gray-200 p-2 text-right font-medium text-gray-800">{fmt(item.quantity * Number(item.price))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Totals */}
                        <div className="flex justify-end mb-6">
                            <div className="w-64 text-sm space-y-1.5">
                                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="font-medium">{fmt(subtotal)}</span></div>
                                {discount > 0 && <div className="flex justify-between text-red-600"><span>Diskon</span><span>− {fmt(discount)}</span></div>}
                                {taxRate > 0 && <div className="flex justify-between text-gray-600"><span>PPN {taxRate}%</span><span className="font-medium">{fmt(taxAmount)}</span></div>}
                                <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t-2 border-gray-300"><span>TOTAL</span><span>{fmt(total)}</span></div>
                            </div>
                        </div>

                        {/* Notes */}
                        {doc.notes && (
                            <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-200 mb-4">
                                <p className="font-semibold text-gray-800 mb-1">Catatan &amp; Syarat:</p>
                                <p className="whitespace-pre-wrap">{doc.notes}</p>
                            </div>
                        )}

                        <p className="text-center text-xs text-gray-400 mt-6 pt-4 border-t border-gray-100">
                            {isQuotation
                                ? "Dokumen ini adalah penawaran harga yang tidak mengikat hingga dikonfirmasi secara tertulis."
                                : "Terima kasih atas kepercayaan Anda. Mohon segera lakukan pembayaran sebelum jatuh tempo."}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
