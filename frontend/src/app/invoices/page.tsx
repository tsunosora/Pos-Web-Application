"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, Send, Eye, Loader2, CheckCircle2 } from "lucide-react";
import { getInvoices, createInvoice, updateInvoiceStatus } from "@/lib/api";
import dayjs from "dayjs";

export default function InvoicePage() {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Form state
    const [clientName, setClientName] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [items, setItems] = useState([{ description: "", quantity: 1, price: 0 }]);

    const { data: invoices, isLoading } = useQuery({
        queryKey: ['invoices'],
        queryFn: getInvoices
    });

    const createMutation = useMutation({
        mutationFn: createInvoice,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            setIsDialogOpen(false);
            setClientName("");
            setDueDate("");
            setItems([{ description: "", quantity: 1, price: 0 }]);
        }
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: number, status: 'SENT' | 'PAID' | 'CANCELLED' }) => updateInvoiceStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        }
    });

    const handleAddItem = () => {
        setItems([...items, { description: "", quantity: 1, price: 0 }]);
    };

    const handleItemChange = (index: number, field: string, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName || !dueDate || items.length === 0) return;

        createMutation.mutate({
            invoiceNumber: `INV-${dayjs().format('YYYYMMDD')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
            clientName,
            dueDate: new Date(dueDate).toISOString(),
            total: calculateTotal(),
            items: {
                create: items.map(item => ({
                    description: item.description,
                    quantity: Number(item.quantity),
                    price: Number(item.price)
                }))
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Invoice Generator</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Buat, kelola, dan kirim faktur tagihan ke klien B2B.</p>
                </div>
                <div className="mt-4 sm:mt-0 flex gap-3">
                    <button
                        onClick={() => setIsDialogOpen(true)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <Plus className="h-4 w-4" />
                        Buat Invoice Baru
                    </button>
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">No Invoice</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Klien</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tanggal</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Nominal</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Aksi</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    </td>
                                </tr>
                            ) : invoices?.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                                        Belum ada invoice.
                                    </td>
                                </tr>
                            ) : (
                                invoices?.map((inv: any) => (
                                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">{inv.invoiceNumber}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-foreground/80">{inv.clientName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{dayjs(inv.date).format('DD MMM YYYY')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium 
                                                ${inv.status === 'PAID' ? 'bg-chart-3/10 text-chart-3' :
                                                    inv.status === 'SENT' ? 'bg-primary/10 text-primary' :
                                                        'bg-muted text-muted-foreground'}`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-foreground text-right">
                                            Rp {parseFloat(inv.total).toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2 text-muted-foreground">
                                                {inv.status !== 'PAID' && (
                                                    <button
                                                        onClick={() => statusMutation.mutate({ id: inv.id, status: 'PAID' })}
                                                        className="hover:text-chart-3 transition-colors p-1"
                                                        title="Mark as Paid"
                                                    >
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button className="hover:text-primary transition-colors p-1" title="Preview"><Eye className="h-4 w-4" /></button>
                                                <button className="hover:text-primary transition-colors p-1" title="Kirim Email"><Send className="h-4 w-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Dialog Create */}
            {isDialogOpen && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-2xl rounded-xl border border-border shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center shrink-0">
                            <h3 className="font-semibold text-foreground">Buat Invoice Baru</h3>
                            <button onClick={() => setIsDialogOpen(false)} className="text-muted-foreground hover:text-foreground">&times;</button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4 grow">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Nama Klien</label>
                                    <input required type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="PT. ABC" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Jatuh Tempo</label>
                                    <input required type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                            </div>

                            <div className="space-y-4 mt-6">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-medium text-sm text-foreground">Item Tagihan</h4>
                                    <button onClick={handleAddItem} className="text-xs text-primary font-medium hover:underline">+ Tambah Item</button>
                                </div>
                                {items.map((item, index) => (
                                    <div key={index} className="flex gap-3 items-start">
                                        <div className="grow space-y-1">
                                            <input required type="text" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} placeholder="Deskripsi layanan/produk" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                        </div>
                                        <div className="w-24 space-y-1">
                                            <input required type="number" min="1" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} placeholder="Qty" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                        </div>
                                        <div className="w-40 space-y-1">
                                            <input required type="number" min="0" value={item.price} onChange={e => handleItemChange(index, 'price', e.target.value)} placeholder="Harga (Rp)" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 pt-4 border-t border-border flex justify-between items-center">
                                <span className="font-medium text-foreground">Total:</span>
                                <span className="text-xl font-bold text-primary">Rp {calculateTotal().toLocaleString('id-ID')}</span>
                            </div>
                        </div>
                        <div className="p-4 border-t border-border bg-muted/20 flex justify-end gap-3 shrink-0">
                            <button type="button" onClick={() => setIsDialogOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-input hover:bg-muted/50 transition-colors">Batal</button>
                            <button onClick={handleSubmit} disabled={createMutation.isPending} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                                {createMutation.isPending ? 'Menyimpan...' : 'Simpan Draft Invoice'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
