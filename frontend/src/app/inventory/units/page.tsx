"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUnits, createUnit, updateUnit, deleteUnit } from '@/lib/api';
import { Plus, Pencil, Trash2, Check, X, Ruler, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { ResponsiveTable, EmptyState } from '@/components/ui/responsive-table';
import { cn } from '@/lib/utils';

export default function UnitsPage() {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const { data: units, isLoading } = useQuery({ queryKey: ['units'], queryFn: getUnits });

    const createMutation = useMutation({
        mutationFn: createUnit,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['units'] });
            setName('');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: { name: string } }) => updateUnit(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['units'] });
            setEditingId(null);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteUnit(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['units'] });
            setDeletingId(null);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) createMutation.mutate({ name });
    };

    const startEdit = (unit: any) => {
        setEditingId(unit.id);
        setEditingName(unit.name);
    };
    const cancelEdit = () => setEditingId(null);
    const saveEdit = () => {
        if (editingId && editingName.trim()) {
            updateMutation.mutate({ id: editingId, data: { name: editingName } });
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <PageHeader
                title="Unit Pengukuran"
                description="Kelola satuan ukur produk seperti Pcs, Kg, Liter, m², dll."
                icon={Ruler}
                breadcrumbs={[
                    { label: 'Inventori', href: '/inventory' },
                    { label: 'Unit Pengukuran' },
                ]}
            />

            {/* Form tambah */}
            <form
                onSubmit={handleSubmit}
                className="mb-5 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Tambah unit baru
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Contoh: Kg, Pcs, Liter, m²"
                        className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                        required
                    />
                    <button
                        type="submit"
                        disabled={createMutation.isPending || !name.trim()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                        {createMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="h-4 w-4" />
                        )}
                        Tambah
                    </button>
                </div>
            </form>

            {/* Table */}
            <ResponsiveTable>
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/40">
                        <tr>
                            <th className="w-16 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ID</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nama Unit</th>
                            <th className="w-32 px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 bg-card">
                        {isLoading ? (
                            <tr>
                                <td colSpan={3} className="px-5 py-10 text-center text-sm text-muted-foreground">
                                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                                </td>
                            </tr>
                        ) : !units || units.length === 0 ? (
                            <tr>
                                <td colSpan={3}>
                                    <EmptyState
                                        icon={Ruler}
                                        title="Belum ada unit"
                                        description="Tambah unit pengukuran pertama menggunakan form di atas."
                                    />
                                </td>
                            </tr>
                        ) : (
                            units.map((unit: any) => (
                                <tr key={unit.id} className="group transition-colors hover:bg-muted/20">
                                    <td className="px-5 py-3 font-mono text-sm text-muted-foreground">#{unit.id}</td>
                                    <td className="px-5 py-3">
                                        {editingId === unit.id ? (
                                            <input
                                                autoFocus
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveEdit();
                                                    if (e.key === 'Escape') cancelEdit();
                                                }}
                                                className="w-full rounded-md border border-primary bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                        ) : (
                                            <span className="text-sm font-medium text-foreground">{unit.name}</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {editingId === unit.id ? (
                                                <>
                                                    <IconBtn onClick={saveEdit} disabled={updateMutation.isPending} tone="success" title="Simpan">
                                                        <Check className="h-4 w-4" />
                                                    </IconBtn>
                                                    <IconBtn onClick={cancelEdit} tone="muted" title="Batal">
                                                        <X className="h-4 w-4" />
                                                    </IconBtn>
                                                </>
                                            ) : deletingId === unit.id ? (
                                                <>
                                                    <span className="mr-1 text-xs font-medium text-destructive">Hapus?</span>
                                                    <IconBtn
                                                        onClick={() => deleteMutation.mutate(unit.id)}
                                                        disabled={deleteMutation.isPending}
                                                        tone="danger"
                                                        title="Ya, hapus"
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </IconBtn>
                                                    <IconBtn onClick={() => setDeletingId(null)} tone="muted" title="Batal">
                                                        <X className="h-4 w-4" />
                                                    </IconBtn>
                                                </>
                                            ) : (
                                                <>
                                                    <IconBtn onClick={() => startEdit(unit)} tone="primary" title="Edit">
                                                        <Pencil className="h-4 w-4" />
                                                    </IconBtn>
                                                    <IconBtn onClick={() => setDeletingId(unit.id)} tone="danger" title="Hapus">
                                                        <Trash2 className="h-4 w-4" />
                                                    </IconBtn>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </ResponsiveTable>
        </div>
    );
}

function IconBtn({
    children,
    tone,
    title,
    onClick,
    disabled,
}: {
    children: React.ReactNode;
    tone: 'primary' | 'success' | 'danger' | 'muted';
    title: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    const tones: Record<string, string> = {
        primary: 'bg-primary/10 text-primary hover:bg-primary/20',
        success: 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400',
        danger: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
        muted: 'bg-muted text-muted-foreground hover:bg-muted/70',
    };
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={cn('rounded-md p-1.5 transition-colors disabled:opacity-50', tones[tone])}
        >
            {children}
        </button>
    );
}
