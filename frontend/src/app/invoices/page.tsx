"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus, Eye, Loader2, CheckCircle2, X, Trash2,
    Pencil, FileText, ClipboardList, ArrowRight, AlertCircle
} from "lucide-react";
import {
    getInvoices, createInvoice, updateInvoice, updateInvoiceStatus,
    deleteInvoice, convertQuotationToInvoice, getSettings
} from "@/lib/api";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/id";
import {
    DocType, Invoice, STATUS_CONFIG, INVOICE_NEXT_STATUSES, QUOTATION_NEXT_STATUSES, fmt
} from "./types";
import { PrintModal } from "./PrintModal";
import { FormModal } from "./FormModal";

dayjs.extend(relativeTime);
dayjs.locale("id");

export default function InvoicesPage() {
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<DocType>("INVOICE");
    const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
    const [editDoc, setEditDoc] = useState<Invoice | null>(null);
    const [previewDoc, setPreviewDoc] = useState<Invoice | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const { data: invoiceData, isLoading: loadingInvoices } = useQuery({ queryKey: ["invoices", "INVOICE"], queryFn: () => getInvoices("INVOICE") });
    const { data: quotationData, isLoading: loadingQuotations } = useQuery({ queryKey: ["invoices", "QUOTATION"], queryFn: () => getInvoices("QUOTATION") });
    const { data: settings } = useQuery({ queryKey: ["store-settings"], queryFn: getSettings, staleTime: 5 * 60 * 1000 });

    const invoices: Invoice[] = invoiceData ?? [];
    const quotations: Invoice[] = quotationData ?? [];
    const docs = activeTab === "INVOICE" ? invoices : quotations;
    const isLoading = activeTab === "INVOICE" ? loadingInvoices : loadingQuotations;

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["invoices", "INVOICE"] });
        queryClient.invalidateQueries({ queryKey: ["invoices", "QUOTATION"] });
    };

    const createMutation = useMutation({ mutationFn: createInvoice, onSuccess: () => { invalidate(); setFormMode(null); } });
    const updateMutation = useMutation({ mutationFn: ({ id, data }: { id: number; data: any }) => updateInvoice(id, data), onSuccess: () => { invalidate(); setFormMode(null); setEditDoc(null); } });
    const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: number; status: string }) => updateInvoiceStatus(id, status), onSuccess: invalidate });
    const deleteMutation = useMutation({ mutationFn: deleteInvoice, onSuccess: () => { invalidate(); setDeleteId(null); } });
    const convertMutation = useMutation({ mutationFn: convertQuotationToInvoice, onSuccess: () => { invalidate(); } });

    const handleSave = (data: any) => {
        if (formMode === "edit" && editDoc) {
            updateMutation.mutate({ id: editDoc.id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    const invoiceSummary = useMemo(() => ({
        total: invoices.length,
        totalValue: invoices.reduce((s, i) => s + parseFloat(i.total), 0),
        unpaid: invoices.filter(i => i.status === "SENT").length,
        unpaidValue: invoices.filter(i => i.status === "SENT").reduce((s, i) => s + parseFloat(i.total), 0),
        overdue: invoices.filter(i => i.status === "SENT" && i.dueDate && dayjs(i.dueDate).isBefore(dayjs())).length,
    }), [invoices]);

    const quotationSummary = useMemo(() => ({
        total: quotations.length,
        pending: quotations.filter(q => q.status === "SENT").length,
        accepted: quotations.filter(q => q.status === "ACCEPTED").length,
        acceptedValue: quotations.filter(q => q.status === "ACCEPTED").reduce((s, q) => s + parseFloat(q.total), 0),
    }), [quotations]);

    const nextStatuses = activeTab === "INVOICE" ? INVOICE_NEXT_STATUSES : QUOTATION_NEXT_STATUSES;
    const isSaving = createMutation.isPending || updateMutation.isPending;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Invoice &amp; Penawaran</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Kelola faktur tagihan dan surat penawaran harga untuk klien B2B.</p>
                </div>
                <button onClick={() => { setEditDoc(null); setFormMode("create"); }}
                    className="mt-4 sm:mt-0 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
                    <Plus className="h-4 w-4" />
                    Buat {activeTab === "INVOICE" ? "Invoice" : "Penawaran Harga"}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit">
                <button onClick={() => setActiveTab("INVOICE")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "INVOICE" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    <FileText className="h-4 w-4" /> Invoice
                    <span className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">{invoices.length}</span>
                </button>
                <button onClick={() => setActiveTab("QUOTATION")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "QUOTATION" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    <ClipboardList className="h-4 w-4" /> Penawaran Harga (SPH)
                    <span className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">{quotations.length}</span>
                </button>
            </div>

            {/* Summary cards */}
            {activeTab === "INVOICE" ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="glass p-4 rounded-xl border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Total Invoice</p>
                        <p className="text-xl font-bold text-foreground">{invoiceSummary.total}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmt(invoiceSummary.totalValue)} total nilai</p>
                    </div>
                    <div className="glass p-4 rounded-xl border border-blue-500/20">
                        <p className="text-xs text-muted-foreground mb-1">Menunggu Pembayaran</p>
                        <p className="text-xl font-bold text-blue-500">{invoiceSummary.unpaid} invoice</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmt(invoiceSummary.unpaidValue)}</p>
                    </div>
                    <div className={`glass p-4 rounded-xl border ${invoiceSummary.overdue > 0 ? "border-destructive/30" : "border-border"}`}>
                        <p className="text-xs text-muted-foreground mb-1">Overdue</p>
                        <p className={`text-xl font-bold ${invoiceSummary.overdue > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {invoiceSummary.overdue} invoice
                        </p>
                        {invoiceSummary.overdue > 0 && (
                            <p className="text-xs text-destructive mt-0.5 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Melewati jatuh tempo
                            </p>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="glass p-4 rounded-xl border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Total Penawaran</p>
                        <p className="text-xl font-bold text-foreground">{quotationSummary.total}</p>
                    </div>
                    <div className="glass p-4 rounded-xl border border-blue-500/20">
                        <p className="text-xs text-muted-foreground mb-1">Menunggu Konfirmasi</p>
                        <p className="text-xl font-bold text-blue-500">{quotationSummary.pending} SPH</p>
                    </div>
                    <div className="glass p-4 rounded-xl border border-emerald-500/20">
                        <p className="text-xs text-muted-foreground mb-1">Diterima → Jadi Invoice</p>
                        <p className="text-xl font-bold text-emerald-600">{quotationSummary.accepted} SPH</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmt(quotationSummary.acceptedValue)}</p>
                    </div>
                </div>
            )}

            {/* Mobile Card List */}
            <div className="md:hidden space-y-3">
                {isLoading ? (
                    <div className="glass rounded-xl border border-border p-10 flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-sm">Memuat data...</span>
                    </div>
                ) : docs.length === 0 ? (
                    <div className="glass rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">
                        Belum ada {activeTab === "INVOICE" ? "invoice" : "penawaran harga"}. Klik tombol di atas untuk membuat.
                    </div>
                ) : docs.map((doc) => {
                    const dateField = activeTab === "INVOICE" ? doc.dueDate : doc.validUntil;
                    const isOverdue = dateField && dayjs(dateField).isBefore(dayjs()) && doc.status === "SENT";
                    const nextSts = nextStatuses[doc.status] ?? [];
                    return (
                        <div key={doc.id} className="glass rounded-xl border border-border p-4 space-y-3">
                            {/* Top row: number + status + total */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-mono font-bold text-primary text-sm">{doc.invoiceNumber}</p>
                                    <p className="font-semibold text-foreground">{doc.clientName}</p>
                                    {doc.clientCompany && <p className="text-xs text-muted-foreground">{doc.clientCompany}</p>}
                                </div>
                                <div className="text-right shrink-0">
                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${STATUS_CONFIG[doc.status].className}`}>
                                        {STATUS_CONFIG[doc.status].label}
                                    </span>
                                    <p className="font-bold text-foreground mt-1">{fmt(parseFloat(doc.total))}</p>
                                </div>
                            </div>

                            {/* Date info */}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>Dibuat: {dayjs(doc.date).format("DD MMM YYYY")}</span>
                                {dateField && (
                                    <span className={isOverdue ? "text-destructive font-medium" : ""}>
                                        {activeTab === "INVOICE" ? "Jatuh Tempo" : "Berlaku s/d"}: {dayjs(dateField).format("DD MMM YYYY")}
                                        {isOverdue && " ⚠ Overdue"}
                                    </span>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 pt-1 border-t border-border/50 flex-wrap">
                                {nextSts.map(ns => (
                                    <button key={ns} onClick={() => statusMutation.mutate({ id: doc.id, status: ns })}
                                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${ns === "PAID" || ns === "ACCEPTED" ? "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" : ns === "CANCELLED" || ns === "REJECTED" ? "border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive/10" : "border-primary/20 text-primary bg-primary/5 hover:bg-primary/10"}`}>
                                        {ns === "PAID" || ns === "ACCEPTED" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                                        {STATUS_CONFIG[ns].label}
                                    </button>
                                ))}
                                {activeTab === "QUOTATION" && doc.status === "ACCEPTED" && (
                                    <button onClick={() => convertMutation.mutate(doc.id)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 transition-colors">
                                        <FileText className="h-3.5 w-3.5" /> Jadi Invoice
                                    </button>
                                )}
                                <div className="flex items-center gap-1 ml-auto">
                                    <button onClick={() => setPreviewDoc(doc)} title="Preview & Cetak"
                                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                                        <Eye className="h-4 w-4" />
                                    </button>
                                    {doc.status === "DRAFT" && (
                                        <button onClick={() => { setEditDoc(doc); setFormMode("edit"); }} title="Edit"
                                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                    )}
                                    <button onClick={() => setDeleteId(doc.id)} title="Hapus"
                                        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Nomor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Klien / Perusahaan</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Dibuat</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{activeTab === "INVOICE" ? "Jatuh Tempo" : "Berlaku s/d"}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                            ) : docs.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                                    Belum ada {activeTab === "INVOICE" ? "invoice" : "penawaran harga"}. Klik tombol di atas untuk membuat.
                                </td></tr>
                            ) : docs.map((doc) => {
                                const dateField = activeTab === "INVOICE" ? doc.dueDate : doc.validUntil;
                                const isOverdue = dateField && dayjs(dateField).isBefore(dayjs()) && doc.status === "SENT";
                                const nextSts = nextStatuses[doc.status] ?? [];
                                return (
                                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-primary">{doc.invoiceNumber}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <p className="text-sm font-semibold text-foreground">{doc.clientName}</p>
                                            {doc.clientCompany && <p className="text-xs text-muted-foreground">{doc.clientCompany}</p>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{dayjs(doc.date).format("DD MMM YYYY")}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {dateField ? (
                                                <span className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                                                    {dayjs(dateField).format("DD MMM YYYY")}
                                                    {isOverdue && <span className="block text-xs">Overdue</span>}
                                                </span>
                                            ) : <span className="text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${STATUS_CONFIG[doc.status].className}`}>
                                                {STATUS_CONFIG[doc.status].label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-foreground text-right">
                                            {fmt(parseFloat(doc.total))}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex justify-end items-center gap-1 text-muted-foreground">
                                                {nextSts.map(ns => (
                                                    <button key={ns} onClick={() => statusMutation.mutate({ id: doc.id, status: ns })}
                                                        title={`Tandai: ${STATUS_CONFIG[ns].label}`}
                                                        className={`p-1.5 rounded hover:bg-muted transition-colors ${ns === "PAID" || ns === "ACCEPTED" ? "hover:text-emerald-600" : ns === "CANCELLED" || ns === "REJECTED" ? "hover:text-destructive" : "hover:text-primary"}`}>
                                                        {ns === "PAID" || ns === "ACCEPTED" ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                                                    </button>
                                                ))}
                                                {activeTab === "QUOTATION" && doc.status === "ACCEPTED" && (
                                                    <button onClick={() => convertMutation.mutate(doc.id)} title="Konversi ke Invoice"
                                                        className="p-1.5 rounded hover:bg-primary/10 hover:text-primary transition-colors">
                                                        <FileText className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button onClick={() => setPreviewDoc(doc)} title="Preview & Cetak"
                                                    className="p-1.5 rounded hover:bg-muted hover:text-primary transition-colors">
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                {doc.status === "DRAFT" && (
                                                    <button onClick={() => { setEditDoc(doc); setFormMode("edit"); }} title="Edit"
                                                        className="p-1.5 rounded hover:bg-muted hover:text-primary transition-colors">
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button onClick={() => setDeleteId(doc.id)} title="Hapus"
                                                    className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Form */}
            {formMode && (
                <FormModal
                    mode={formMode}
                    docType={activeTab}
                    initial={editDoc ?? undefined}
                    onClose={() => { setFormMode(null); setEditDoc(null); }}
                    onSave={handleSave}
                    isPending={isSaving}
                />
            )}

            {/* Print Preview */}
            {previewDoc && <PrintModal doc={previewDoc} settings={settings} onClose={() => setPreviewDoc(null)} />}

            {/* Delete confirm */}
            {deleteId !== null && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-sm rounded-xl border border-border shadow-lg p-6 animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="font-semibold text-foreground mb-2">Hapus Dokumen?</h3>
                        <p className="text-sm text-muted-foreground mb-6">Data tidak dapat dipulihkan setelah dihapus.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-input hover:bg-muted/50 transition-colors">Batal</button>
                            <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50">
                                {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
