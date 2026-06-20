"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUnits, createUnit, updateUnit, deleteUnit } from '@/lib/api';
import { Plus, Pencil, Trash2, Check, X, Ruler, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/responsive-table';

/**
 * Panel slide-over untuk kelola unit pengukuran langsung dari halaman Manajemen Stok.
 * Sejalan dengan CategoryPanel: aksi selalu terlihat (touch-friendly), responsif
 * (full-width mobile, drawer kanan desktop), memakai query ['units'] yang sama.
 */
export default function UnitPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const { data: units = [], isLoading } = useQuery({ queryKey: ['units'], queryFn: getUnits, enabled: open });

    const createMutation = useMutation({
        mutationFn: createUnit,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['units'] }); setName(''); },
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: { name: string } }) => updateUnit(id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['units'] }); setEditingId(null); },
    });
    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteUnit(id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['units'] }); setDeletingId(null); },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) createMutation.mutate({ name: name.trim() });
    };
    const startEdit = (unit: any) => { setEditingId(unit.id); setEditingName(unit.name); setDeletingId(null); };
    const saveEdit = () => { if (editingId && editingName.trim()) updateMutation.mutate({ id: editingId, data: { name: editingName.trim() } }); };

    if (!open) return null;

    const iconBtn = "h-9 w-9 flex items-center justify-center rounded-lg transition-colors shrink-0";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/25 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="glass-strong w-full max-w-md rounded-2xl border border-border shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 fade-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-border shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 bg-primary/10 rounded-lg shrink-0"><Ruler className="w-5 h-5 text-primary" /></div>
                        <div className="min-w-0">
                            <h3 className="font-semibold text-foreground leading-tight">Unit Pengukuran</h3>
                            <p className="text-xs text-muted-foreground truncate">{units.length} unit · Pcs, Kg, Liter, m², dll.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`${iconBtn} hover:bg-muted text-muted-foreground`} aria-label="Tutup"><X className="w-5 h-5" /></button>
                </div>

                {/* Form tambah */}
                <form onSubmit={handleSubmit} className="px-4 py-3 border-b border-border bg-muted/20 shrink-0">
                    <div className="flex gap-2">
                        <input
                            type="text" value={name} onChange={(e) => setName(e.target.value)}
                            placeholder="Contoh: Kg, Pcs, Liter, m²" required
                            className="flex-1 min-w-0 px-3 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                        />
                        <button type="submit" disabled={createMutation.isPending || !name.trim()}
                            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3.5 py-2.5 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm shrink-0">
                            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Tambah
                        </button>
                    </div>
                </form>

                {/* Daftar unit (scroll) */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="px-5 py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
                    ) : units.length === 0 ? (
                        <EmptyState icon={Ruler} title="Belum ada unit" description="Tambah unit pengukuran pertama lewat form di atas." />
                    ) : (
                        <div className="divide-y divide-border/50">
                            {units.map((unit: any) => {
                                const isEditing = editingId === unit.id;
                                const isDeleting = deletingId === unit.id;
                                return (
                                    <div key={unit.id} className={`flex items-center gap-2 px-3 py-2.5 ${isEditing ? 'bg-primary/5' : ''}`}>
                                        <span className="text-[11px] font-mono text-muted-foreground/60 shrink-0 w-9">#{unit.id}</span>
                                        <div className="flex-1 min-w-0">
                                            {isEditing ? (
                                                <input autoFocus value={editingName} onChange={(e) => setEditingName(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                                                    className="w-full px-2.5 py-2 bg-background border border-primary rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                                            ) : (
                                                <span className="text-sm font-medium text-foreground">{unit.name}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {isEditing ? (
                                                <>
                                                    <button onClick={saveEdit} disabled={updateMutation.isPending} className={`${iconBtn} bg-green-500/10 text-green-600 hover:bg-green-500/20`} title="Simpan"><Check className="w-4 h-4" /></button>
                                                    <button onClick={() => setEditingId(null)} className={`${iconBtn} bg-muted text-muted-foreground hover:bg-muted/70`} title="Batal"><X className="w-4 h-4" /></button>
                                                </>
                                            ) : isDeleting ? (
                                                <>
                                                    <span className="text-xs text-destructive font-medium">Hapus?</span>
                                                    <button onClick={() => deleteMutation.mutate(unit.id)} disabled={deleteMutation.isPending} className={`${iconBtn} bg-destructive/10 text-destructive hover:bg-destructive/20`}><Check className="w-4 h-4" /></button>
                                                    <button onClick={() => setDeletingId(null)} className={`${iconBtn} bg-muted text-muted-foreground hover:bg-muted/70`}><X className="w-4 h-4" /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEdit(unit)} className={`${iconBtn} bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary`} title="Edit"><Pencil className="w-4 h-4" /></button>
                                                    <button onClick={() => setDeletingId(unit.id)} className={`${iconBtn} bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive`} title="Hapus"><Trash2 className="w-4 h-4" /></button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
