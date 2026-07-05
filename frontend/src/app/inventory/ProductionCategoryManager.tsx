"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getProductionCategories,
    createProductionCategory,
    updateProductionCategory,
    deleteProductionCategory,
    type ProductionCategory,
    type ProductionSource,
    type ProductionMeasure,
} from '@/lib/api';
import { Plus, Pencil, Trash2, Check, X, Loader2, Factory } from 'lucide-react';

const SOURCE_OPTIONS: { value: ProductionSource; label: string; chip: string }[] = [
    { value: 'CETAK', label: 'Dari bahan cetak', chip: 'Cetak' },
    { value: 'PRODUKSI', label: 'Dari antrian produksi', chip: 'Produksi' },
];
const MEASURE_OPTIONS: { value: ProductionMeasure; label: string; chip: string }[] = [
    { value: 'AREA', label: 'Luas m²', chip: 'm²' },
    { value: 'PCS', label: 'Pcs/lembar', chip: 'Pcs' },
];

const sourceLabel = (s: ProductionSource) => SOURCE_OPTIONS.find(o => o.value === s)?.chip ?? s;
const measureLabel = (m: ProductionMeasure) => MEASURE_OPTIONS.find(o => o.value === m)?.chip ?? m;

export default function ProductionCategoryManager() {
    const queryClient = useQueryClient();

    const { data: cats = [], isLoading } = useQuery({ queryKey: ['production-categories'], queryFn: getProductionCategories });

    // Form tambah
    const [newName, setNewName] = useState('');
    const [newSource, setNewSource] = useState<ProductionSource>('PRODUKSI');
    const [newMeasure, setNewMeasure] = useState<ProductionMeasure>('AREA');

    // Edit inline
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [editingSource, setEditingSource] = useState<ProductionSource>('PRODUKSI');
    const [editingMeasure, setEditingMeasure] = useState<ProductionMeasure>('AREA');

    // Konfirmasi hapus
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['production-categories'] });
        queryClient.invalidateQueries({ queryKey: ['categories'] });
    };

    const createMutation = useMutation({
        mutationFn: createProductionCategory,
        onSuccess: () => { invalidate(); setNewName(''); setNewSource('PRODUKSI'); setNewMeasure('AREA'); },
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: { name: string; source: ProductionSource; measureBy: ProductionMeasure } }) => updateProductionCategory(id, data),
        onSuccess: () => { invalidate(); setEditingId(null); },
    });
    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteProductionCategory(id),
        onSuccess: () => { invalidate(); setDeletingId(null); },
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        createMutation.mutate({ name: newName.trim(), source: newSource, measureBy: newMeasure });
    };

    const startEdit = (cat: ProductionCategory) => {
        setEditingId(cat.id);
        setEditingName(cat.name);
        setEditingSource(cat.source);
        setEditingMeasure(cat.measureBy);
        setDeletingId(null);
    };

    const saveEdit = () => {
        if (!editingId || !editingName.trim()) return;
        updateMutation.mutate({ id: editingId, data: { name: editingName.trim(), source: editingSource, measureBy: editingMeasure } });
    };

    const selectCls = "px-2 py-2 bg-background border border-border rounded-lg outline-none text-sm focus:ring-2 focus:ring-primary";

    return (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-start gap-2.5">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0"><Factory className="w-5 h-5 text-primary" /></div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Kategori Produksi</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                        Jenis produksi untuk breakdown leaderboard operator (mis. Banner, Stiker, Laser Cut).
                        Sumber = dari mana dihitung; Satuan = tampilan angka.
                    </p>
                </div>
            </div>

            {/* Form tambah */}
            <form onSubmit={handleCreate} className="flex flex-wrap gap-2 items-center">
                <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Nama jenis produksi..."
                    className="flex-1 min-w-[140px] px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                    required
                />
                <select value={newSource} onChange={e => setNewSource(e.target.value as ProductionSource)} className={selectCls} title="Sumber perhitungan">
                    {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select value={newMeasure} onChange={e => setNewMeasure(e.target.value as ProductionMeasure)} className={selectCls} title="Satuan tampilan">
                    {MEASURE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button type="submit" disabled={createMutation.isPending || !newName.trim()}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3.5 py-2 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm">
                    <Plus className="w-4 h-4" /> Tambah
                </button>
            </form>

            {/* Daftar */}
            <div className="rounded-lg border border-border/60 overflow-hidden">
                {isLoading ? (
                    <div className="px-4 py-6 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
                ) : cats.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-muted-foreground">Belum ada kategori produksi. Tambahkan lewat form di atas.</p>
                ) : (
                    <div className="divide-y divide-border/50">
                        {cats.map(cat => {
                            const isEditing = editingId === cat.id;
                            const isDeleting = deletingId === cat.id;
                            return (
                                <div key={cat.id} className={`flex items-center gap-2 px-3 py-2.5 ${isEditing ? 'bg-primary/5' : ''}`}>
                                    <div className="flex-1 min-w-0">
                                        {isEditing ? (
                                            <div className="flex flex-wrap gap-2 items-center">
                                                <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                                                    className="flex-1 min-w-[120px] px-2.5 py-1.5 bg-background border border-primary rounded-md text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                                                <select value={editingSource} onChange={e => setEditingSource(e.target.value as ProductionSource)}
                                                    className="px-2 py-1.5 bg-background border border-border rounded-md text-xs outline-none" title="Sumber">
                                                    {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                </select>
                                                <select value={editingMeasure} onChange={e => setEditingMeasure(e.target.value as ProductionMeasure)}
                                                    className="px-2 py-1.5 bg-background border border-border rounded-md text-xs outline-none" title="Satuan">
                                                    {MEASURE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-semibold text-foreground">{cat.name}</span>
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-600 border border-sky-500/20 text-[10px] font-semibold whitespace-nowrap">
                                                    {sourceLabel(cat.source)}
                                                </span>
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 text-[10px] font-semibold whitespace-nowrap">
                                                    {measureLabel(cat.measureBy)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isEditing ? (
                                            <>
                                                <button onClick={saveEdit} disabled={updateMutation.isPending}
                                                    className="p-1.5 rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors" title="Simpan">
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setEditingId(null)}
                                                    className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/70 transition-colors" title="Batal">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : isDeleting ? (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] text-destructive text-right leading-tight max-w-[180px]">
                                                    Hapus? Kategori barang yang memakainya akan otomatis dilepas.
                                                </span>
                                                <button onClick={() => deleteMutation.mutate(cat.id)} disabled={deleteMutation.isPending}
                                                    className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setDeletingId(null)}
                                                    className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/70 transition-colors">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button onClick={() => startEdit(cat)}
                                                    className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" title="Edit">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setDeletingId(cat.id)}
                                                    className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title="Hapus">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
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
    );
}
