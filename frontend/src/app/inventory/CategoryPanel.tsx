"use client";

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/lib/api';
import { Plus, Pencil, Trash2, Check, X, ChevronRight, FolderOpen, Folder, FolderPlus, FolderTree, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/responsive-table';

interface Category {
    id: number;
    name: string;
    parentId: number | null;
    countsAsPcs: boolean;
    parent: { id: number; name: string } | null;
    children: { id: number; name: string; parentId: number; countsAsPcs?: boolean }[];
}

function AddonBadge() {
    return (
        <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold whitespace-nowrap dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
            title='Item kategori ini tidak dihitung di metrik pcs (komponen/add-on seperti kerah, lengan)'
        >
            ⛔ tidak dihitung pcs
        </span>
    );
}

/**
 * Panel slide-over untuk kelola kategori langsung dari halaman Manajemen Stok —
 * tanpa pindah halaman. Aksi selalu terlihat (touch-friendly), responsif: full-width
 * di mobile, drawer kanan di desktop. Memakai query ['categories'] yang sama sehingga
 * tab/filter kategori di halaman stok ikut ter-refresh.
 */
export default function CategoryPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
    const queryClient = useQueryClient();

    const [newName, setNewName] = useState('');
    const [newParentId, setNewParentId] = useState<string>('');
    const [newCountsAsPcs, setNewCountsAsPcs] = useState(true);

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [editingParentId, setEditingParentId] = useState<string>('');
    const [editingCountsAsPcs, setEditingCountsAsPcs] = useState(true);

    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [addSubFor, setAddSubFor] = useState<number | null>(null);
    const [subName, setSubName] = useState('');
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const { data: categoriesRaw = [], isLoading } = useQuery({ queryKey: ['categories'], queryFn: getCategories, enabled: open });
    const categories: Category[] = categoriesRaw;

    const parents = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
    const getChildren = (parentId: number) => categories.filter((c) => c.parentId === parentId);
    const parentOptions = parents;

    const createMutation = useMutation({
        mutationFn: createCategory,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setNewName(''); setNewParentId(''); setNewCountsAsPcs(true); }
    });
    const createSubMutation = useMutation({
        mutationFn: createCategory,
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setAddSubFor(null); setSubName('');
            if (vars.parentId) setExpandedIds(prev => new Set([...prev, vars.parentId!]));
        }
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: { name: string; parentId?: number | null; countsAsPcs?: boolean } }) => updateCategory(id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setEditingId(null); }
    });
    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteCategory(id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setDeletingId(null); }
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        createMutation.mutate({ name: newName.trim(), parentId: newParentId ? Number(newParentId) : null, countsAsPcs: newCountsAsPcs });
    };
    const handleCreateSub = (e: React.FormEvent, parentId: number) => {
        e.preventDefault();
        if (!subName.trim()) return;
        createSubMutation.mutate({ name: subName.trim(), parentId });
    };
    const startEdit = (cat: { id: number; name: string; parentId: number | null; countsAsPcs?: boolean }) => {
        setEditingId(cat.id); setEditingName(cat.name);
        setEditingParentId(cat.parentId ? String(cat.parentId) : '');
        setEditingCountsAsPcs(cat.countsAsPcs ?? true); setDeletingId(null);
    };
    const saveEdit = () => {
        if (!editingId || !editingName.trim()) return;
        updateMutation.mutate({ id: editingId, data: { name: editingName.trim(), parentId: editingParentId ? Number(editingParentId) : null, countsAsPcs: editingCountsAsPcs } });
    };
    const toggleExpand = (id: number) => {
        setExpandedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    };

    if (!open) return null;

    const totalCount = categories.length;
    const parentCount = parents.length;
    const subCount = categories.filter((c) => !!c.parentId).length;

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
                        <div className="p-2 bg-primary/10 rounded-lg shrink-0"><FolderTree className="w-5 h-5 text-primary" /></div>
                        <div className="min-w-0">
                            <h3 className="font-semibold text-foreground leading-tight">Kelola Kategori</h3>
                            <p className="text-xs text-muted-foreground truncate">{totalCount} kategori · {parentCount} utama, {subCount} sub</p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`${iconBtn} hover:bg-muted text-muted-foreground`} aria-label="Tutup"><X className="w-5 h-5" /></button>
                </div>

                {/* Form Tambah */}
                <form onSubmit={handleCreate} className="px-4 py-3 border-b border-border bg-muted/20 space-y-2.5 shrink-0">
                    <div className="flex gap-2">
                        <input
                            type="text" value={newName} onChange={e => setNewName(e.target.value)}
                            placeholder="Nama kategori baru..." required
                            className="flex-1 min-w-0 px-3 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                        />
                        <button type="submit" disabled={createMutation.isPending || !newName.trim()}
                            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3.5 py-2.5 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm shrink-0">
                            <Plus className="w-4 h-4" /> Tambah
                        </button>
                    </div>
                    <select value={newParentId} onChange={e => setNewParentId(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm">
                        <option value="">— Kategori Utama (tanpa parent) —</option>
                        {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={newCountsAsPcs} onChange={e => setNewCountsAsPcs(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                        <span className="text-[11px] text-muted-foreground leading-snug">
                            <span className="font-semibold text-foreground">Hitung sebagai produk (pcs) di laporan CRM.</span> Matikan untuk add-on/komponen (kerah, lengan) agar tidak terhitung pcs terpisah.
                        </span>
                    </label>
                </form>

                {/* Daftar kategori (scroll) */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="px-5 py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
                    ) : parents.length === 0 ? (
                        <EmptyState icon={FolderTree} title="Belum ada kategori" description="Buat kategori utama dulu lewat form di atas, lalu tambah sub-kategori dengan tombol folder+." />
                    ) : (
                        <div className="divide-y divide-border/50">
                            {parents.map((cat) => {
                                const children = getChildren(cat.id);
                                const isExpanded = expandedIds.has(cat.id);
                                const isEditing = editingId === cat.id;
                                const isDeleting = deletingId === cat.id;
                                const isAddingSub = addSubFor === cat.id;
                                return (
                                    <div key={cat.id}>
                                        {/* Baris parent */}
                                        <div className={`flex items-center gap-2 px-3 py-2.5 ${isEditing ? 'bg-primary/5' : ''}`}>
                                            <button type="button" onClick={() => children.length > 0 && toggleExpand(cat.id)}
                                                className={`shrink-0 ${children.length > 0 ? 'text-primary cursor-pointer' : 'text-muted-foreground/40 cursor-default'}`}>
                                                {children.length > 0 && isExpanded ? <FolderOpen className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                {isEditing ? (
                                                    <div className="space-y-2">
                                                        <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                                                            className="w-full px-2.5 py-2 bg-background border border-primary rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                                                        <div className="flex gap-2 items-center flex-wrap">
                                                            <select value={editingParentId} onChange={e => setEditingParentId(e.target.value)}
                                                                className="flex-1 min-w-[120px] px-2 py-1.5 bg-background border border-border rounded-lg text-xs outline-none">
                                                                <option value="">Kategori Utama</option>
                                                                {parentOptions.filter(p => p.id !== cat.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                            </select>
                                                            <label className="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap cursor-pointer select-none">
                                                                <input type="checkbox" checked={editingCountsAsPcs} onChange={e => setEditingCountsAsPcs(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
                                                                hitung pcs
                                                            </label>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-semibold text-foreground">{cat.name}</span>
                                                        {cat.countsAsPcs === false && <AddonBadge />}
                                                        {children.length > 0 && (
                                                            <button type="button" onClick={() => toggleExpand(cat.id)}
                                                                className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-primary transition-colors">
                                                                <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                                {children.length} sub
                                                            </button>
                                                        )}
                                                    </div>
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
                                                        <button onClick={() => deleteMutation.mutate(cat.id)} disabled={deleteMutation.isPending} className={`${iconBtn} bg-destructive/10 text-destructive hover:bg-destructive/20`}><Check className="w-4 h-4" /></button>
                                                        <button onClick={() => setDeletingId(null)} className={`${iconBtn} bg-muted text-muted-foreground hover:bg-muted/70`}><X className="w-4 h-4" /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => { setAddSubFor(isAddingSub ? null : cat.id); setSubName(''); setExpandedIds(prev => new Set([...prev, cat.id])); }}
                                                            className={`${iconBtn} ${isAddingSub ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary hover:bg-primary/20'}`} title="Tambah sub-kategori"><FolderPlus className="w-4 h-4" /></button>
                                                        <button onClick={() => startEdit(cat)} className={`${iconBtn} bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary`} title="Edit"><Pencil className="w-4 h-4" /></button>
                                                        <button onClick={() => setDeletingId(cat.id)} className={`${iconBtn} bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive`} title="Hapus"><Trash2 className="w-4 h-4" /></button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Form tambah sub */}
                                        {isAddingSub && (
                                            <form onSubmit={e => handleCreateSub(e, cat.id)} className="flex items-center gap-2 pl-10 pr-3 py-2 bg-primary/5 border-t border-primary/20">
                                                <FolderPlus className="w-4 h-4 text-primary shrink-0" />
                                                <input autoFocus type="text" value={subName} onChange={e => setSubName(e.target.value)}
                                                    placeholder={`Sub di "${cat.name}"...`}
                                                    className="flex-1 min-w-0 px-2.5 py-2 bg-background border border-primary/40 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                                                <button type="submit" disabled={createSubMutation.isPending || !subName.trim()} className="px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 shrink-0">Tambah</button>
                                                <button type="button" onClick={() => setAddSubFor(null)} className={`${iconBtn} text-muted-foreground hover:bg-muted`}><X className="w-4 h-4" /></button>
                                            </form>
                                        )}

                                        {/* Sub-kategori */}
                                        {isExpanded && children.length > 0 && (
                                            <div className="bg-muted/20 divide-y divide-border/30">
                                                {children.map((child: any) => {
                                                    const isEditingChild = editingId === child.id;
                                                    const isDeletingChild = deletingId === child.id;
                                                    return (
                                                        <div key={child.id} className={`flex items-center gap-2 pl-10 pr-3 py-2.5 ${isEditingChild ? 'bg-primary/5' : ''}`}>
                                                            <div className="w-1.5 h-1.5 rounded-full bg-border shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                {isEditingChild ? (
                                                                    <div className="space-y-2">
                                                                        <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)}
                                                                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                                                                            className="w-full px-2.5 py-2 bg-background border border-primary rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                                                                        <div className="flex gap-2 items-center flex-wrap">
                                                                            <select value={editingParentId} onChange={e => setEditingParentId(e.target.value)}
                                                                                className="flex-1 min-w-[120px] px-2 py-1.5 bg-background border border-border rounded-lg text-xs outline-none">
                                                                                <option value="">Jadikan Kategori Utama</option>
                                                                                {parentOptions.filter(p => p.id !== child.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                                            </select>
                                                                            <label className="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap cursor-pointer select-none">
                                                                                <input type="checkbox" checked={editingCountsAsPcs} onChange={e => setEditingCountsAsPcs(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
                                                                                hitung pcs
                                                                            </label>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-sm text-foreground flex items-center gap-2 flex-wrap">
                                                                        {child.name}
                                                                        {child.countsAsPcs === false && <AddonBadge />}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                {isEditingChild ? (
                                                                    <>
                                                                        <button onClick={saveEdit} disabled={updateMutation.isPending} className={`${iconBtn} bg-green-500/10 text-green-600 hover:bg-green-500/20`}><Check className="w-4 h-4" /></button>
                                                                        <button onClick={() => setEditingId(null)} className={`${iconBtn} bg-muted text-muted-foreground hover:bg-muted/70`}><X className="w-4 h-4" /></button>
                                                                    </>
                                                                ) : isDeletingChild ? (
                                                                    <>
                                                                        <span className="text-xs text-destructive font-medium">Hapus?</span>
                                                                        <button onClick={() => deleteMutation.mutate(child.id)} disabled={deleteMutation.isPending} className={`${iconBtn} bg-destructive/10 text-destructive hover:bg-destructive/20`}><Check className="w-4 h-4" /></button>
                                                                        <button onClick={() => setDeletingId(null)} className={`${iconBtn} bg-muted text-muted-foreground hover:bg-muted/70`}><X className="w-4 h-4" /></button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button onClick={() => startEdit(child)} className={`${iconBtn} bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary`} title="Edit"><Pencil className="w-4 h-4" /></button>
                                                                        <button onClick={() => setDeletingId(child.id)} className={`${iconBtn} bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive`} title="Hapus"><Trash2 className="w-4 h-4" /></button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
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
