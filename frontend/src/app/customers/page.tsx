"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from "@/lib/api";
import { useState } from "react";
import { Plus, Edit2, Trash2, Search, X } from "lucide-react";

export default function CustomersPage() {
    const { data: customers, isLoading, refetch } = useQuery({ queryKey: ["customers"], queryFn: getCustomers });
    const [searchQuery, setSearchQuery] = useState("");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({ name: "", phone: "", address: "" });

    const createMutation = useMutation({
        mutationFn: createCustomer,
        onSuccess: () => {
            refetch();
            closeModal();
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number, data: any }) => updateCustomer(id, data),
        onSuccess: () => {
            refetch();
            closeModal();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCustomer,
        onSuccess: () => refetch()
    });

    const openModal = (customer?: any) => {
        if (customer) {
            setEditingId(customer.id);
            setFormData({ name: customer.name, phone: customer.phone || "", address: customer.address || "" });
        } else {
            setEditingId(null);
            setFormData({ name: "", phone: "", address: "" });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData({ name: "", phone: "", address: "" });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            updateMutation.mutate({ id: editingId, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleDelete = (id: number) => {
        if (confirm("Apakah Anda yakin ingin menghapus pelanggan ini?")) {
            deleteMutation.mutate(id);
        }
    };

    const filteredCustomers = customers?.filter((c: any) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone && c.phone.includes(searchQuery))
    ) || [];

    return (
        <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-3">
                        📋 Database Pelanggan
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Kelola informasi detail pelanggan untuk mempermudah transaksi repeat order.
                    </p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                    <Plus className="w-5 h-5" />
                    Tambah Pelanggan Baru
                </button>
            </div>

            {/* Filter */}
            <div className="flex items-center px-4 py-2 bg-background border border-border shadow-sm rounded-2xl w-full max-w-md focus-within:ring-2 ring-primary/20 transition-all">
                <Search className="w-5 h-5 text-muted-foreground mr-3" />
                <input
                    type="text"
                    placeholder="Cari nama atau no HP pelanggan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-sm font-medium"
                />
            </div>

            {/* Table */}
            <div className="bg-background rounded-3xl shadow-sm border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-muted-foreground uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-4">Nama Pelanggan</th>
                                <th className="px-6 py-4">No. HP / WhatsApp</th>
                                <th className="px-6 py-4">Alamat</th>
                                <th className="px-6 py-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                                        Memuat data pelanggan...
                                    </td>
                                </tr>
                            ) : filteredCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                                        Data pelanggan tidak ditemukan.
                                    </td>
                                </tr>
                            ) : (
                                filteredCustomers.map((customer: any) => (
                                    <tr key={customer.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-foreground">
                                            {customer.name}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {customer.phone || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground truncate max-w-[250px]">
                                            {customer.address || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openModal(customer)}
                                                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                    title="Edit Pelanggan"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(customer.id)}
                                                    className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                                    title="Hapus"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-background rounded-3xl shadow-xl border border-border w-full max-w-md p-6 relative animate-in zoom-in-95 duration-200">
                        <button
                            onClick={closeModal}
                            className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-xl font-bold mb-6">
                            {editingId ? "Edit Data Pelanggan" : "Tambah Pelanggan Baru"}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-foreground/80">Nama Lengkap</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 ring-primary/20 outline-none transition-all"
                                    placeholder="Contoh: Budi Santoso"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-foreground/80">Nomor HP / WA</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 ring-primary/20 outline-none transition-all"
                                    placeholder="Contoh: 081234567890"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-foreground/80">Alamat</label>
                                <textarea
                                    className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl focus:bg-background focus:ring-2 ring-primary/20 outline-none transition-all min-h-[100px] resize-y"
                                    placeholder="Contoh: Jl. Merdeka No. 1..."
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={closeModal} className="flex-1 px-4 py-3 bg-muted hover:bg-border text-foreground font-semibold rounded-xl transition-all">
                                    Batal
                                </button>
                                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-sm transition-all disabled:opacity-50">
                                    {(createMutation.isPending || updateMutation.isPending) ? "Menyimpan..." : "Simpan Data"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
