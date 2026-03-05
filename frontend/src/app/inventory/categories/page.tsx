"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/lib/api';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';

export default function CategoriesPage() {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const { data: categories, isLoading } = useQuery({ queryKey: ['categories'], queryFn: getCategories });

    const createMutation = useMutation({
        mutationFn: createCategory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setName('');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: { name: string } }) => updateCategory(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setEditingId(null);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteCategory(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setDeletingId(null);
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) createMutation.mutate({ name });
    };

    const startEdit = (cat: any) => {
        setEditingId(cat.id);
        setEditingName(cat.name);
    };

    const cancelEdit = () => setEditingId(null);

    const saveEdit = () => {
        if (editingId && editingName.trim()) {
            updateMutation.mutate({ id: editingId, data: { name: editingName } });
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Manajemen Kategori</h1>
                    <p className="text-sm text-muted-foreground mt-1">Tambah, ubah, atau hapus kategori produk.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-3">
                <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Nama kategori baru..."
                    className="flex-1 px-4 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                    required
                />
                <button type="submit" disabled={createMutation.isPending} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm text-sm">
                    <Plus className="w-4 h-4" /> Tambah
                </button>
            </form>

            <div className="glass rounded-xl shadow-sm border border-border overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-5 py-3.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">ID</th>
                            <th className="px-5 py-3.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Nama Kategori</th>
                            <th className="px-5 py-3.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 bg-card">
                        {isLoading ? (
                            <tr><td colSpan={3} className="px-5 py-6 text-center text-muted-foreground text-sm">Memuat...</td></tr>
                        ) : categories?.length === 0 ? (
                            <tr><td colSpan={3} className="px-5 py-6 text-center text-muted-foreground text-sm">Belum ada kategori.</td></tr>
                        ) : (
                            categories?.map((cat: any) => (
                                <tr key={cat.id} className="hover:bg-muted/20 transition-colors group">
                                    <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">{cat.id}</td>
                                    <td className="px-5 py-3.5">
                                        {editingId === cat.id ? (
                                            <input
                                                autoFocus
                                                value={editingName}
                                                onChange={e => setEditingName(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                                className="w-full px-3 py-1.5 bg-background border border-primary rounded-md text-sm outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                        ) : (
                                            <span className="text-sm font-medium text-foreground">{cat.name}</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {editingId === cat.id ? (
                                                <>
                                                    <button onClick={saveEdit} disabled={updateMutation.isPending} className="p-1.5 rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors" title="Simpan">
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={cancelEdit} className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/70 transition-colors" title="Batal">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : deletingId === cat.id ? (
                                                <>
                                                    <span className="text-xs text-destructive mr-1">Hapus?</span>
                                                    <button onClick={() => deleteMutation.mutate(cat.id)} disabled={deleteMutation.isPending} className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors" title="Ya, hapus">
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setDeletingId(null)} className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/70 transition-colors" title="Batal">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEdit(cat)} className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors opacity-0 group-hover:opacity-100" title="Edit">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setDeletingId(cat.id)} className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors opacity-0 group-hover:opacity-100" title="Hapus">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
